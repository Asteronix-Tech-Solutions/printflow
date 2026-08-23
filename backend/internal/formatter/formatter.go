package formatter

import (
	"bytes"
	"fmt"
	"html/template"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
	"pintflow/backend/internal/models"
)

type Formatter struct{}

func NewFormatter() *Formatter {
	return &Formatter{}
}

// GetSystemTemplates returns built-in visual templates
func (f *Formatter) GetSystemTemplates() []*models.FormTemplate {
	now := time.Now()
	return []*models.FormTemplate{
		{
			ID:          "property_checkin",
			Name:        "Property & Guest Check-in Card",
			Description: "Designed for Hotel/Villa guest registration forms with multi-guest support (1 page per guest), dates, ID uploaded notices, and statement of responsibility.",
			IsSystem:    true,
			ContentHTML: systemTemplatePropertyCheckin,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "default",
			Name:        "Modern Table Summary",
			Description: "Clean, structured table layout suitable for all general Google Form submissions.",
			IsSystem:    true,
			ContentHTML: systemTemplateDefaultTable,
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}
}

// RenderFormHTML generates rendered HTML string using template ID or custom HTML
func (f *Formatter) RenderFormHTML(job *models.Job, templateID string, customHTML string) (string, error) {
	var rawHTML string

	if customHTML != "" {
		rawHTML = customHTML
	} else {
		if templateID == "" {
			templateID = job.TemplateID
		}
		if templateID == "" {
			// Auto-detect if property form data is present
			if f.hasPropertyFields(job) {
				templateID = "property_checkin"
			} else {
				templateID = "default"
			}
		}

		for _, tmpl := range f.GetSystemTemplates() {
			if tmpl.ID == templateID {
				rawHTML = tmpl.ContentHTML
				break
			}
		}
		if rawHTML == "" {
			rawHTML = systemTemplateDefaultTable
		}
	}

	// Prepare data context for Go HTML template rendering
	data := f.buildTemplateData(job)

	t, err := template.New("form_template").Funcs(template.FuncMap{
		"escapeHTML": escapeHTML,
		"lower":      strings.ToLower,
	}).Parse(rawHTML)

	if err != nil {
		// Fallback simple replacement if html/template parse fails
		return f.fallbackSimpleReplace(rawHTML, job), nil
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return f.fallbackSimpleReplace(rawHTML, job), nil
	}

	return buf.String(), nil
}

// GenerateFormSummaryDocument builds HTML file on disk
func (f *Formatter) GenerateFormSummaryDocument(job *models.Job, destPath string) error {
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory for form summary: %w", err)
	}

	htmlContent, err := f.RenderFormHTML(job, job.TemplateID, "")
	if err != nil {
		return err
	}

	return os.WriteFile(destPath, []byte(htmlContent), 0644)
}

// GenerateFormSummaryPDF generates a print-ready PDF file on disk from job form response data
func (f *Formatter) GenerateFormSummaryPDF(job *models.Job, destPath string) error {
	if err := os.MkdirAll(filepath.Dir(destPath), 0755); err != nil {
		return fmt.Errorf("failed to create directory for form PDF summary: %w", err)
	}

	templateID := job.TemplateID
	if templateID == "" {
		if f.hasPropertyFields(job) {
			templateID = "property_checkin"
		} else {
			templateID = "default"
		}
	}

	pdfBytes, err := f.GeneratePDFBytes(job, templateID)
	if err != nil {
		return fmt.Errorf("failed to generate PDF bytes: %w", err)
	}

	return os.WriteFile(destPath, pdfBytes, 0644)
}

// GeneratePDFBytes generates PDF binary data for a job and visual template
func (f *Formatter) GeneratePDFBytes(job *models.Job, templateID string) ([]byte, error) {
	if templateID == "" {
		if f.hasPropertyFields(job) {
			templateID = "property_checkin"
		} else {
			templateID = "default"
		}
	}

	data := f.buildTemplateData(job)
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(12, 12, 12)
	pdf.SetAutoPageBreak(true, 12)

	switch templateID {
	case "property_checkin":
		f.renderPropertyCheckinPDF(pdf, data)
	case "compact_pass":
		f.renderCompactPassPDF(pdf, data)
	case "id_compliance":
		f.renderIDCompliancePDF(pdf, data)
	default:
		f.renderDefaultTablePDF(pdf, data)
	}

	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (f *Formatter) renderPropertyCheckinPDF(pdf *fpdf.Fpdf, data TemplateDataContext) {
	getVal := func(keys ...string) string {
		for _, k := range keys {
			if v, ok := data.Map[strings.ToLower(strings.TrimSpace(k))]; ok && v != "" {
				return v
			}
			if v, ok := data.Map[strings.TrimSpace(k)]; ok && v != "" {
				return v
			}
		}
		return "N/A"
	}

	propName := getVal("which property have you booked?", "property", "booked property")
	checkinDate := getVal("check-in date", "check in date", "checkin")
	checkoutDate := getVal("check-out date", "check out date", "checkout")
	phone := getVal("phone", "mobile", "contact")
	marital := getVal("my/our martial status is", "marital status", "marital")
	purpose := getVal("purpose of visit", "purpose")

	guests := data.Guests
	if len(guests) == 0 {
		guests = f.extractGuests(data)
	}
	totalPages := len(guests)
	g1Name := guests[0].Name

	for pageIdx, guest := range guests {
		pageNum := pageIdx + 1
		pdf.AddPage()

		// Header Banner - SMART HOME NEXUS : GUEST REGISTER
		pdf.SetFillColor(15, 23, 42) // slate-900
		pdf.Rect(12, 10, 186, 22, "F")
		pdf.SetTextColor(255, 255, 255)
		pdf.SetFont("Arial", "B", 13)
		pdf.SetXY(16, 13)
		pdf.Cell(130, 6, "SMART HOME NEXUS : GUEST REGISTER")
		pdf.SetFont("Arial", "", 8)
		pdf.SetTextColor(148, 163, 184) // slate-400
		pdf.SetXY(16, 20)
		pdf.Cell(90, 4, "https://smarthomenexus.net")
		pdf.SetXY(16, 25)
		pdf.Cell(90, 4, fmt.Sprintf("Guest %d Details & Photo ID Proof", guest.Index))

		// Page indicator top-right
		pdf.SetTextColor(255, 255, 255)
		pdf.SetFont("Arial", "B", 8)
		pdf.SetXY(155, 13)
		pdf.Cell(40, 5, fmt.Sprintf("PAGE %d OF %d", pageNum, totalPages))

		// Licenses Row
		pdf.SetFillColor(241, 245, 249) // slate-100
		pdf.SetDrawColor(226, 232, 240)
		pdf.Rect(12, 34, 186, 10, "DF")
		pdf.SetTextColor(71, 85, 105) // slate-500
		pdf.SetFont("Arial", "", 7.5)
		pdf.SetXY(16, 36)
		pdf.Cell(90, 5, "CE 1: <Placeholder>")
		pdf.SetXY(110, 36)
		pdf.Cell(84, 5, "CE 2: <Placeholder>")

		// Property & Booking Info Box
		pdf.SetFillColor(240, 253, 244) // green-50
		pdf.SetDrawColor(187, 247, 208)
		pdf.Rect(12, 46, 186, 16, "DF")
		pdf.SetTextColor(22, 101, 52)
		pdf.SetFont("Arial", "B", 9)
		pdf.SetXY(16, 48)
		pdf.Cell(90, 4, "Property: "+sanitizeText(propName))
		pdf.SetTextColor(71, 85, 105)
		pdf.SetFont("Arial", "", 8)
		pdf.SetXY(110, 48)
		if pageNum == 1 {
			pdf.Cell(84, 4, "Submitted: "+sanitizeText(data.CreatedAtFormatted))
		} else {
			pdf.Cell(84, 4, "Primary Guest: "+sanitizeText(g1Name))
		}
		pdf.SetXY(16, 55)
		pdf.Cell(90, 4, fmt.Sprintf("Check-in: %s  |  Check-out: %s", sanitizeText(checkinDate), sanitizeText(checkoutDate)))

		// Guest Info Grid
		pdf.SetY(65)
		pdf.SetTextColor(15, 23, 42)
		pdf.SetFont("Arial", "B", 10)
		pdf.Cell(186, 5, fmt.Sprintf("GUEST %d INFORMATION & CONTACT DETAILS", guest.Index))
		pdf.Ln(6)

		currY := pdf.GetY()
		guestPhone := guest.Phone
		if guestPhone == "N/A" || guestPhone == "" {
			guestPhone = phone
		}

		if pageNum == 1 {
			f.renderInfoBox(pdf, 12, currY, 59, 13, "Guest 1 Full Name", guest.Name)
			f.renderInfoBox(pdf, 75, currY, 59, 13, "Phone Number", guestPhone)
			f.renderInfoBox(pdf, 138, currY, 60, 13, "Email Address", data.UserEmail)

			currY += 15
			f.renderInfoBox(pdf, 12, currY, 59, 13, "Age", guest.Age)
			f.renderInfoBox(pdf, 75, currY, 59, 13, "Marital Status", marital)
			f.renderInfoBox(pdf, 138, currY, 60, 13, "Purpose of Visit", purpose)
		} else {
			f.renderInfoBox(pdf, 12, currY, 59, 13, fmt.Sprintf("Guest %d Full Name", guest.Index), guest.Name)
			f.renderInfoBox(pdf, 75, currY, 59, 13, "Age", guest.Age)
			contactInfo := guestPhone
			if guest.Gender != "N/A" && guest.Gender != "" {
				contactInfo = fmt.Sprintf("%s (%s)", guestPhone, guest.Gender)
			}
			f.renderInfoBox(pdf, 138, currY, 60, 13, fmt.Sprintf("Guest %d Phone / Info", guest.Index), contactInfo)

			currY += 15
			f.renderInfoBox(pdf, 12, currY, 59, 13, "Marital Status", marital)
			f.renderInfoBox(pdf, 75, currY, 59, 13, "Purpose of Visit", purpose)
			f.renderInfoBox(pdf, 138, currY, 60, 13, "Primary Email", data.UserEmail)
		}
		pdf.SetY(currY + 16)

		// Embedded Photo ID Image Box
		pdf.SetTextColor(15, 23, 42)
		pdf.SetFont("Arial", "B", 9)
		pdf.Cell(186, 5, fmt.Sprintf("GUEST %d UPLOADED PHOTO ID PROOF (AADHAR / PASSPORT)", guest.Index))
		pdf.Ln(5)

		imgY := pdf.GetY()
		pdf.SetFillColor(248, 250, 252)
		pdf.SetDrawColor(226, 232, 240)
		pdf.Rect(12, imgY, 186, 118, "DF")

		imgPaths := guest.ImagePaths
		if len(imgPaths) == 0 && guest.ImagePath != "" {
			imgPaths = []string{guest.ImagePath}
		}

		if len(imgPaths) >= 2 {
			// Render images side by side within the picture area
			imgCount := len(imgPaths)
			if imgCount > 4 {
				imgCount = 4 // cap at 4 side-by-side
			}
			gap := 3.0                                                        // gap between images in mm
			totalGap := gap * float64(imgCount-1)                             // total gap space
			imgW := (180.0 - totalGap) / float64(imgCount)                    // width per image
			imgH := 112.0                                                     // full height of picture area
			for j := 0; j < imgCount; j++ {
				imgX := 15.0 + float64(j)*(imgW+gap)
				pdf.ImageOptions(imgPaths[j], imgX, imgY+3, imgW, imgH, false, fpdf.ImageOptions{ImageType: ""}, 0, "")
			}
		} else if len(imgPaths) == 1 {
			pdf.ImageOptions(imgPaths[0], 15, imgY+3, 180, 112, false, fpdf.ImageOptions{ImageType: ""}, 0, "")
		} else {
			pdf.SetTextColor(100, 116, 139)
			pdf.SetFont("Arial", "I", 10)
			pdf.SetXY(15, imgY+52)
			pdf.Cell(180, 6, fmt.Sprintf("[ No Photo ID image attached for Guest %d ]", guest.Index))
		}
		pdf.SetY(imgY + 121)

		// Statement of Responsibility
		pdf.SetFillColor(254, 252, 232) // amber-50
		pdf.SetDrawColor(254, 240, 138)
		stmtY := pdf.GetY()
		pdf.Rect(12, stmtY, 186, 14, "DF")
		pdf.SetTextColor(133, 89, 0)
		pdf.SetFont("Arial", "B", 7)
		pdf.SetXY(15, stmtY+2)
		if pageNum == 1 {
			pdf.Cell(180, 3, "STATEMENT OF RESPONSIBILITY & GUEST ID COMPLIANCE:")
			pdf.SetFont("Arial", "", 7)
			pdf.SetXY(15, stmtY+5.5)
			pdf.MultiCell(180, 3, "Guest 1 verifies providing authentic ID proof. Guest agrees to comply with property safety guidelines, check-in policies, and local regulations.", "", "L", false)
		} else {
			pdf.Cell(180, 3, fmt.Sprintf("GUEST %d COMPLIANCE & UNDERTAKING:", guest.Index))
			pdf.SetFont("Arial", "", 7)
			pdf.SetXY(15, stmtY+5.5)
			pdf.MultiCell(180, 3, fmt.Sprintf("Guest %d acknowledges adherence to check-in terms, guest policies, and legal verification requirements for the duration of stay.", guest.Index), "", "L", false)
		}

		// Digital Signature Notice
		pdf.SetY(stmtY + 16)
		pdf.SetTextColor(100, 116, 139)
		pdf.SetFont("Arial", "I", 8)
		pdf.Cell(186, 4, "Document Digitally Signed. No signature required.")

		// Footer with Job ID
		pdf.SetY(280)
		pdf.SetTextColor(148, 163, 184)
		pdf.SetFont("Arial", "", 7)
		pdf.Cell(93, 4, "Smart Home Nexus | smarthomenexus.net")
		pdf.Cell(93, 4, "Job Ref: "+sanitizeText(data.JobID))
	}
}


func (f *Formatter) renderDefaultTablePDF(pdf *fpdf.Fpdf, data TemplateDataContext) {
	pdf.AddPage()

	// Title Header
	pdf.SetFillColor(79, 70, 229)
	pdf.Rect(12, 12, 186, 20, "F")
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 14)
	pdf.SetXY(16, 16)
	pdf.Cell(120, 6, sanitizeText(data.FormTitle))
	pdf.SetFont("Arial", "", 9)
	pdf.SetXY(16, 23)
	pdf.Cell(120, 5, "PintFlow Form Response Summary Document")

	pdf.SetY(36)

	// Metadata Table
	pdf.SetFillColor(249, 250, 251)
	pdf.SetDrawColor(229, 231, 235)
	pdf.Rect(12, 36, 186, 20, "DF")
	pdf.SetTextColor(55, 65, 81)
	pdf.SetFont("Arial", "B", 9)
	pdf.SetXY(15, 38)
	pdf.Cell(40, 5, "Respondent:")
	pdf.SetFont("Arial", "", 9)
	pdf.Cell(130, 5, sanitizeText(data.UserName))

	pdf.SetFont("Arial", "B", 9)
	pdf.SetXY(15, 44)
	pdf.Cell(40, 5, "Email:")
	pdf.SetFont("Arial", "", 9)
	pdf.Cell(130, 5, sanitizeText(data.UserEmail))

	pdf.SetFont("Arial", "B", 9)
	pdf.SetXY(15, 50)
	pdf.Cell(40, 5, "Submitted At:")
	pdf.SetFont("Arial", "", 9)
	pdf.Cell(130, 5, sanitizeText(data.CreatedAtFormatted)+"  (Job ID: "+sanitizeText(data.JobID)+")")

	pdf.SetY(60)
	pdf.SetTextColor(30, 41, 59)
	pdf.SetFont("Arial", "B", 11)
	pdf.Cell(186, 6, "FORM RESPONSES")
	pdf.Ln(7)

	f.renderQATable(pdf, data.Responses)

	pdf.Ln(6)
	pdf.SetTextColor(148, 163, 184)
	pdf.SetFont("Arial", "I", 8)
	pdf.CellFormat(186, 5, fmt.Sprintf("Printed automatically via PintFlow • Job ID: %s", data.JobID), "", 0, "C", false, 0, "")
}

func (f *Formatter) renderCompactPassPDF(pdf *fpdf.Fpdf, data TemplateDataContext) {
	pdf.AddPage()

	pdf.SetDrawColor(2, 132, 199)
	pdf.SetLineWidth(0.6)
	pdf.Rect(12, 12, 186, 260, "D")
	pdf.SetLineWidth(0.2)

	// Top Banner
	pdf.SetFillColor(2, 132, 199)
	pdf.Rect(12, 12, 186, 18, "F")
	pdf.SetTextColor(255, 255, 255)
	pdf.SetFont("Arial", "B", 13)
	pdf.SetXY(16, 17)
	pdf.Cell(130, 7, sanitizeText(data.FormTitle))
	pdf.SetFont("Arial", "B", 9)
	pdf.SetXY(150, 17)
	pdf.Cell(40, 7, "PASS VOUCHER")

	pdf.SetY(34)
	f.renderInfoBox(pdf, 16, pdf.GetY(), 88, 14, "Respondent", data.UserName)
	f.renderInfoBox(pdf, 106, pdf.GetY(), 88, 14, "Email", data.UserEmail)
	pdf.SetY(pdf.GetY() + 16)
	f.renderInfoBox(pdf, 16, pdf.GetY(), 88, 14, "Submitted Date", data.CreatedAtFormatted)
	f.renderInfoBox(pdf, 106, pdf.GetY(), 88, 14, "Job ID", data.JobID)
	pdf.SetY(pdf.GetY() + 18)

	pdf.SetTextColor(3, 105, 161)
	pdf.SetFont("Arial", "B", 10)
	pdf.SetX(16)
	pdf.Cell(178, 6, "SUMMARY DATA")
	pdf.Ln(7)

	f.renderQATable(pdf, data.Responses)

	pdf.Ln(8)
	pdf.SetTextColor(148, 163, 184)
	pdf.SetFont("Arial", "B", 8)
	pdf.CellFormat(186, 5, "PintFlow Compact Pass • Verification Document", "", 0, "C", false, 0, "")
}

func (f *Formatter) renderIDCompliancePDF(pdf *fpdf.Fpdf, data TemplateDataContext) {
	pdf.AddPage()

	pdf.SetDrawColor(220, 38, 38)
	pdf.SetLineWidth(0.6)
	pdf.Rect(12, 12, 186, 265, "D")
	pdf.SetLineWidth(0.2)

	// Red Header
	pdf.SetFillColor(254, 242, 242)
	pdf.SetDrawColor(254, 202, 202)
	pdf.Rect(16, 16, 178, 18, "DF")
	pdf.SetTextColor(153, 27, 27)
	pdf.SetFont("Arial", "B", 11)
	pdf.SetXY(20, 22)
	pdf.Cell(170, 6, "SECURITY & GUEST ID COMPLIANCE VERIFICATION RECORD")

	pdf.SetY(38)
	f.renderInfoBox(pdf, 16, pdf.GetY(), 88, 14, "Respondent Name", data.UserName)
	f.renderInfoBox(pdf, 106, pdf.GetY(), 88, 14, "Email", data.UserEmail)
	pdf.SetY(pdf.GetY() + 16)
	f.renderInfoBox(pdf, 16, pdf.GetY(), 88, 14, "Submission Date", data.CreatedAtFormatted)
	f.renderInfoBox(pdf, 106, pdf.GetY(), 88, 14, "Job Reference", data.JobID)
	pdf.SetY(pdf.GetY() + 18)

	pdf.SetTextColor(185, 28, 28)
	pdf.SetFont("Arial", "B", 10)
	pdf.SetX(16)
	pdf.Cell(178, 6, "SUBMITTED IDENTIFICATION & VERIFICATION RESPONSES")
	pdf.Ln(7)

	f.renderQATable(pdf, data.Responses)

	pdf.Ln(8)
	f.renderSignatureBlock(pdf, "Auditor / Verifier Signature", data.JobID, "Security Officer Signature")
}

func (f *Formatter) renderInfoBox(pdf *fpdf.Fpdf, x, y, w, h float64, label, val string) {
	pdf.SetFillColor(248, 250, 252)
	pdf.SetDrawColor(226, 232, 240)
	pdf.Rect(x, y, w, h, "DF")

	pdf.SetTextColor(100, 116, 139)
	pdf.SetFont("Arial", "B", 7)
	pdf.SetXY(x+3, y+2)
	pdf.Cell(w-6, 4, strings.ToUpper(label))

	pdf.SetTextColor(15, 23, 42)
	pdf.SetFont("Arial", "B", 8)
	pdf.SetXY(x+3, y+7)
	pdf.Cell(w-6, 4, sanitizeText(val))
}

func (f *Formatter) renderQATable(pdf *fpdf.Fpdf, responses []models.FormQuestionAnswer) {
	pdf.SetFillColor(238, 242, 255)
	pdf.SetDrawColor(199, 210, 254)
	pdf.SetTextColor(55, 65, 81)
	pdf.SetFont("Arial", "B", 8)

	pdf.SetX(12)
	pdf.CellFormat(80, 6, "QUESTION FIELD", "1", 0, "L", true, 0, "")
	pdf.CellFormat(106, 6, "SUBMITTED RESPONSE", "1", 1, "L", true, 0, "")

	pdf.SetFont("Arial", "", 8)
	pdf.SetDrawColor(229, 231, 235)

	isEven := false
	for _, qa := range responses {
		if isEven {
			pdf.SetFillColor(249, 250, 251)
		} else {
			pdf.SetFillColor(255, 255, 255)
		}

		qText := sanitizeText(qa.Question)
		aText := sanitizeText(qa.Answer)

		// Calculate height required for text
		qLines := pdf.SplitLines([]byte(qText), 76)
		aLines := pdf.SplitLines([]byte(aText), 102)

		lineCount := len(qLines)
		if len(aLines) > lineCount {
			lineCount = len(aLines)
		}
		if lineCount < 1 {
			lineCount = 1
		}

		rowH := float64(lineCount*4 + 4)
		if pdf.GetY()+rowH > 280 {
			pdf.AddPage()
			pdf.SetFillColor(238, 242, 255)
			pdf.SetFont("Arial", "B", 8)
			pdf.SetX(12)
			pdf.CellFormat(80, 6, "QUESTION FIELD", "1", 0, "L", true, 0, "")
			pdf.CellFormat(106, 6, "SUBMITTED RESPONSE", "1", 1, "L", true, 0, "")
			pdf.SetFont("Arial", "", 8)
			if isEven {
				pdf.SetFillColor(249, 250, 251)
			} else {
				pdf.SetFillColor(255, 255, 255)
			}
		}

		currY := pdf.GetY()
		pdf.Rect(12, currY, 80, rowH, "DF")
		pdf.Rect(92, currY, 106, rowH, "DF")

		pdf.SetTextColor(15, 23, 42)
		pdf.SetXY(14, currY+2)
		pdf.MultiCell(76, 4, qText, "", "L", false)

		pdf.SetXY(94, currY+2)
		pdf.MultiCell(102, 4, aText, "", "L", false)

		pdf.SetY(currY + rowH)
		isEven = !isEven
	}
}

func (f *Formatter) renderSignatureBlock(pdf *fpdf.Fpdf, sig1Title, jobID, sig2Title string) {
	currY := pdf.GetY()
	if currY > 260 {
		pdf.AddPage()
		currY = pdf.GetY()
	}

	pdf.SetDrawColor(100, 116, 139)
	pdf.Line(20, currY+14, 80, currY+14)
	pdf.Line(130, currY+14, 190, currY+14)

	pdf.SetTextColor(100, 116, 139)
	pdf.SetFont("Arial", "", 8)
	pdf.SetXY(20, currY+15)
	pdf.Cell(60, 4, sig1Title)

	pdf.SetXY(80, currY+15)
	pdf.CellFormat(50, 4, "Job Ref: "+sanitizeText(jobID), "", 0, "C", false, 0, "")

	pdf.SetXY(130, currY+15)
	pdf.Cell(60, 4, sig2Title)
}

func sanitizeText(str string) string {
	str = strings.ReplaceAll(str, "\n", " ")
	str = strings.ReplaceAll(str, "\r", "")
	str = strings.ReplaceAll(str, "\t", " ")
	return strings.TrimSpace(str)
}


type GuestDetails struct {
	Index      int
	Name       string
	Age        string
	Phone      string
	Gender     string
	ImagePath  string   // primary image (kept for backward compat)
	ImagePaths []string // all images for this guest
}

type TemplateDataContext struct {
	FormTitle          string
	UserName           string
	UserEmail          string
	JobID              string
	CreatedAtFormatted string
	Filename           string
	ImagePaths         []string
	Responses          []models.FormQuestionAnswer
	Map                map[string]string
	Guests             []GuestDetails
}

func (f *Formatter) extractGuests(data TemplateDataContext) []GuestDetails {
	getVal := func(keys ...string) string {
		for _, k := range keys {
			if v, ok := data.Map[strings.ToLower(strings.TrimSpace(k))]; ok && v != "" {
				return v
			}
			if v, ok := data.Map[strings.TrimSpace(k)]; ok && v != "" {
				return v
			}
		}
		return "N/A"
	}

	selection := getVal("guest selection", "add another guest", "guests")

	maxCount := 1
	reNum := regexp.MustCompile(`(\d+)`)
	if match := reNum.FindString(selection); match != "" {
		if count, err := strconv.Atoi(match); err == nil && count > 1 {
			maxCount = count
		}
	}

	for k := range data.Map {
		kLower := strings.ToLower(k)
		if idx := strings.Index(kLower, "guest"); idx != -1 {
			sub := strings.TrimSpace(kLower[idx+5:])
			if match := reNum.FindString(sub); match != "" {
				if num, err := strconv.Atoi(match); err == nil && num > maxCount {
					maxCount = num
				}
			}
		}
	}

	// NOTE: We no longer inflate maxCount from image count.
	// Extra images beyond the guest count are assigned to the
	// corresponding guest (side-by-side rendering).

	if maxCount > 20 {
		maxCount = 20
	}

	primaryPhone := getVal("phone", "mobile", "contact")
	var guests []GuestDetails

	for i := 1; i <= maxCount; i++ {
		nameKey1 := fmt.Sprintf("name of guest %d", i)
		nameKey2 := fmt.Sprintf("guest %d name", i)
		nameKey3 := fmt.Sprintf("guest %d", i)
		nameKey4 := fmt.Sprintf("guest%d", i)

		gName := getVal(nameKey1, nameKey2, nameKey3, nameKey4)
		if i == 1 && (gName == "N/A" || gName == "") {
			gName = getVal("name", "full name")
			if gName == "N/A" || gName == "" {
				gName = data.UserName
			}
		}

		ageKey1 := fmt.Sprintf("age of guest %d", i)
		ageKey2 := fmt.Sprintf("guest %d age", i)
		ageKey3 := fmt.Sprintf("age guest %d", i)
		gAge := getVal(ageKey1, ageKey2, ageKey3)
		if i == 1 && (gAge == "N/A" || gAge == "") {
			gAge = getVal("ages", "age")
		}

		phoneKey1 := fmt.Sprintf("phone of guest %d", i)
		phoneKey2 := fmt.Sprintf("guest %d phone", i)
		phoneKey3 := fmt.Sprintf("phone number of guest %d", i)
		phoneKey4 := fmt.Sprintf("guest %d mobile", i)
		phoneKey5 := fmt.Sprintf("mobile of guest %d", i)
		gPhone := getVal(phoneKey1, phoneKey2, phoneKey3, phoneKey4, phoneKey5)
		if gPhone == "N/A" || gPhone == "" {
			if i == 1 {
				gPhone = primaryPhone
			}
		}

		genderKey1 := fmt.Sprintf("guest %d gender", i)
		genderKey2 := fmt.Sprintf("gender of guest %d", i)
		gGender := getVal(genderKey1, genderKey2)
		if i == 1 && (gGender == "N/A" || gGender == "") {
			gGender = getVal("gender")
		}

		guests = append(guests, GuestDetails{
			Index:  i,
			Name:   gName,
			Age:    gAge,
			Phone:  gPhone,
			Gender: gGender,
		})
	}

	if len(guests) == 0 {
		guests = append(guests, GuestDetails{
			Index:  1,
			Name:   data.UserName,
			Age:    getVal("ages", "age"),
			Phone:  primaryPhone,
			Gender: getVal("gender"),
		})
	}

	// Distribute images among guests.
	// Each guest gets one image in order. Any remaining images are
	// appended to the last guest so they render side-by-side.
	for idx := 0; idx < len(data.ImagePaths); idx++ {
		if idx < len(guests) {
			guests[idx].ImagePaths = append(guests[idx].ImagePaths, data.ImagePaths[idx])
			guests[idx].ImagePath = data.ImagePaths[idx]
		} else {
			// Extra images go to the last guest
			last := len(guests) - 1
			guests[last].ImagePaths = append(guests[last].ImagePaths, data.ImagePaths[idx])
		}
	}

	return guests
}

func (f *Formatter) buildTemplateData(job *models.Job) TemplateDataContext {
	formTitle := job.FormTitle
	if formTitle == "" {
		formTitle = "Google Form Submission Summary"
	}
	userName := job.UserName
	if userName == "" {
		userName = "Guest Respondent"
	}
	userEmail := job.UserEmail
	if userEmail == "" {
		userEmail = "N/A"
	}

	qMap := make(map[string]string)
	for _, qa := range job.FormResponses {
		qMap[strings.TrimSpace(qa.Question)] = qa.Answer
		qMap[strings.ToLower(strings.TrimSpace(qa.Question))] = qa.Answer
	}

	var imgPaths []string
	for i := 1; i <= 20; i++ {
		fTempMatches, _ := filepath.Glob(filepath.Join("storage/temp", fmt.Sprintf("%s_file_%d_*", job.ID, i)))
		if len(fTempMatches) > 0 && isImageFile(fTempMatches[0]) {
			imgPaths = append(imgPaths, fTempMatches[0])
			continue
		}
		fArchMatches, _ := filepath.Glob(filepath.Join("storage/archive/*", fmt.Sprintf("%s_file_%d_*", job.ID, i)))
		if len(fArchMatches) > 0 && isImageFile(fArchMatches[0]) {
			imgPaths = append(imgPaths, fArchMatches[0])
			continue
		}
	}

	var allImgs []string
	if job.Filename != "" {
		tPath := filepath.Join("storage/temp", fmt.Sprintf("%s_%s", job.ID, job.Filename))
		if isImageFile(tPath) {
			allImgs = append(allImgs, tPath)
		}
		archMatches, _ := filepath.Glob(filepath.Join("storage/archive/*", fmt.Sprintf("%s_%s", job.ID, job.Filename)))
		for _, m := range archMatches {
			if isImageFile(m) && !sliceContains(allImgs, m) {
				allImgs = append(allImgs, m)
				break
			}
		}
	}
	jobTempMatches, _ := filepath.Glob(filepath.Join("storage/temp", fmt.Sprintf("%s_*", job.ID)))
	for _, m := range jobTempMatches {
		if isImageFile(m) && !sliceContains(allImgs, m) {
			allImgs = append(allImgs, m)
		}
	}
	archJobMatches, _ := filepath.Glob(filepath.Join("storage/archive/*", fmt.Sprintf("%s_*", job.ID)))
	for _, m := range archJobMatches {
		if isImageFile(m) && !sliceContains(allImgs, m) {
			allImgs = append(allImgs, m)
		}
	}

	for _, img := range allImgs {
		if !sliceContains(imgPaths, img) {
			imgPaths = append(imgPaths, img)
		}
	}

	ctx := TemplateDataContext{
		FormTitle:          formTitle,
		UserName:           userName,
		UserEmail:          userEmail,
		JobID:              job.ID,
		CreatedAtFormatted: job.CreatedAt.Format("02 Jan 2006, 15:04 MST"),
		Filename:           job.Filename,
		ImagePaths:         imgPaths,
		Responses:          job.FormResponses,
		Map:                qMap,
	}
	ctx.Guests = f.extractGuests(ctx)
	return ctx
}


func isImageFile(filePath string) bool {
	if fi, err := os.Stat(filePath); err == nil && !fi.IsDir() && fi.Size() > 0 {
		ext := strings.ToLower(filepath.Ext(filePath))
		return ext == ".jpg" || ext == ".jpeg" || ext == ".png" || ext == ".gif" || ext == ".webp"
	}
	return false
}

func sliceContains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}


func (f *Formatter) hasPropertyFields(job *models.Job) bool {
	for _, qa := range job.FormResponses {
		q := strings.ToLower(qa.Question)
		if strings.Contains(q, "property") || strings.Contains(q, "guest") || strings.Contains(q, "check-in") || strings.Contains(q, "marital") {
			return true
		}
	}
	return false
}

func (f *Formatter) fallbackSimpleReplace(tmpl string, job *models.Job) string {
	res := tmpl
	res = strings.ReplaceAll(res, "{{.FormTitle}}", escapeHTML(job.FormTitle))
	res = strings.ReplaceAll(res, "{{.UserName}}", escapeHTML(job.UserName))
	res = strings.ReplaceAll(res, "{{.UserEmail}}", escapeHTML(job.UserEmail))
	res = strings.ReplaceAll(res, "{{.JobID}}", escapeHTML(job.ID))
	res = strings.ReplaceAll(res, "{{.CreatedAtFormatted}}", job.CreatedAt.Format("02 Jan 2006, 15:04 MST"))

	var rows strings.Builder
	for _, qa := range job.FormResponses {
		rows.WriteString(fmt.Sprintf("<tr><td><strong>%s</strong></td><td>%s</td></tr>\n", escapeHTML(qa.Question), escapeHTML(qa.Answer)))
	}
	res = strings.ReplaceAll(res, "{{.ResponseRows}}", rows.String())
	return res
}

func escapeHTML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}

// System Templates HTML Definitions

const systemTemplatePropertyCheckin = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>{{.FormTitle}}</title>
<style>
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #1e293b; background: #ffffff; line-height: 1.5; }
  .card-container { border: 2px solid #3b82f6; border-radius: 12px; padding: 24px; max-width: 900px; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
  .header { display: flex; justify-content: space-between; align-items: center; border-b: 2px dashed #cbd5e1; padding-bottom: 16px; margin-bottom: 20px; }
  .title { font-size: 22px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; tracking: 0.5px; }
  .badge { background: #dbeafe; color: #1e40af; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 9999px; border: 1px solid #bfdbfe; }
  .property-banner { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
  .property-name { font-size: 18px; font-weight: 700; color: #166534; }
  .section-title { font-size: 14px; font-weight: 700; color: #334155; text-transform: uppercase; margin: 18px 0 10px 0; border-left: 4px solid #3b82f6; padding-left: 8px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
  .label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 2px; }
  .val { font-size: 13px; font-weight: 600; color: #0f172a; word-break: break-word; }
  .table-qa { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .table-qa th { background: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 8px 10px; text-align: left; border: 1px solid #e2e8f0; }
  .table-qa td { padding: 8px 10px; border: 1px solid #e2e8f0; font-size: 12px; }
  .table-qa tr:nth-child(even) { background: #f8fafc; }
  .statement-box { background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; padding: 12px; font-size: 11px; color: #855900; margin-top: 16px; }
  .signature-area { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-t: 1px solid #e2e8f0; }
  .sig-line { width: 220px; border-top: 1px solid #64748b; text-align: center; font-size: 11px; color: #64748b; padding-top: 4px; }
  .footer { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 20px; }
</style>
</head>
<body>
<div class="card-container">
  <div class="header">
    <div>
      <div class="title">{{.FormTitle}}</div>
      <div style="font-size: 12px; color: #64748b;">PintFlow Automated Guest Check-in Form Record</div>
    </div>
    <div class="badge">CONFIRMED BOOKING</div>
  </div>

  <div class="property-banner">
    <div>
      <div class="label">Booked Property</div>
      <div class="property-name">{{index .Map "which property have you booked?"}}</div>
    </div>
    <div style="text-align: right;">
      <div class="label">Submitted Date</div>
      <div class="val">{{.CreatedAtFormatted}}</div>
    </div>
  </div>

  <div class="section-title">Primary Guest & Contact Info</div>
  <div class="grid-3">
    <div class="info-box"><div class="label">Primary Guest</div><div class="val">{{.UserName}}</div></div>
    <div class="info-box"><div class="label">Phone</div><div class="val">{{index .Map "phone"}}</div></div>
    <div class="info-box"><div class="label">Email</div><div class="val">{{.UserEmail}}</div></div>
    <div class="info-box"><div class="label">Marital Status</div><div class="val">{{index .Map "my/our martial status is"}}</div></div>
    <div class="info-box"><div class="label">Purpose of Visit</div><div class="val">{{index .Map "purpose of visit"}}</div></div>
    <div class="info-box"><div class="label">Guest Selection</div><div class="val">{{index .Map "guest selection"}}</div></div>
  </div>

  <div class="section-title">Stay & Guest Details</div>
  <table class="table-qa">
    <thead>
      <tr>
        <th>Guest Unit</th>
        <th>Guest Name</th>
        <th>Age</th>
        <th>Gender</th>
      </tr>
    </thead>
    <tbody>
      {{range .Guests}}
      <tr>
        <td><strong>Guest {{.Index}}</strong></td>
        <td>{{.Name}}</td>
        <td>{{.Age}}</td>
        <td>{{.Gender}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>

  <div class="section-title">Full Form Response Data</div>
  <table class="table-qa">
    <thead>
      <tr><th style="width: 45%;">Question Field</th><th style="width: 55%;">Submitted Answer</th></tr>
    </thead>
    <tbody>
      {{range .Responses}}
      <tr>
        <td><strong>{{.Question}}</strong></td>
        <td>{{.Answer}}</td>
      </tr>
      {{end}}
    </tbody>
  </table>

  <div class="statement-box">
    <strong>Statement Of Responsibility & ID Compliance:</strong><br>
    All guests have verified providing authentic ID proof (Aadhar Card or Passport with clear Name, Photo, address & Number). Guest agrees to comply with property guidelines and local safety regulations.
  </div>

  <div class="signature-area">
    <div class="sig-line">Guest Signature</div>
    <div style="font-size: 11px; color: #64748b;">Job ID: {{.JobID}}</div>
    <div class="sig-line">Property Manager Signature</div>
  </div>

  <div class="footer">Printed automatically by PintFlow • Automatic Google Form Printing Engine</div>
</div>
</body>
</html>`

const systemTemplateDefaultTable = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>{{.FormTitle}}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 40px; color: #111827; background: #ffffff; }
  .header { border-bottom: 2px solid #4f46e5; padding-bottom: 16px; margin-bottom: 24px; }
  .title { font-size: 24px; font-weight: bold; color: #1e1b4b; margin: 0 0 8px 0; }
  .subtitle { font-size: 13px; color: #6b7280; font-weight: 500; }
  .meta-grid { display: table; width: 100%; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
  .meta-row { display: table-row; }
  .meta-label { display: table-cell; font-weight: bold; font-size: 12px; color: #374151; padding: 4px 12px 4px 0; text-transform: uppercase; }
  .meta-val { display: table-cell; font-size: 13px; color: #111827; padding: 4px 0; }
  .section-heading { font-size: 16px; font-weight: bold; color: #374151; margin-bottom: 12px; border-left: 4px solid #4f46e5; padding-left: 8px; }
  table.qa-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  table.qa-table th { background: #eef2ff; color: #374151; font-size: 12px; text-transform: uppercase; text-align: left; padding: 10px 12px; border: 1px solid #c7d2fe; }
  table.qa-table td { padding: 10px 12px; border: 1px solid #e5e7eb; font-size: 13px; vertical-align: top; }
  table.qa-table tr:nth-child(even) { background: #f9fafb; }
  .footer { font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #e5e7eb; padding-top: 12px; margin-top: 40px; }
</style>
</head>
<body>
<div class="header">
  <div class="title">{{.FormTitle}}</div>
  <div class="subtitle">PintFlow Automatic Form Submission Print Record</div>
</div>

<div class="meta-grid">
  <div class="meta-row"><div class="meta-label">Respondent:</div><div class="meta-val">{{.UserName}}</div></div>
  <div class="meta-row"><div class="meta-label">Email:</div><div class="meta-val">{{.UserEmail}}</div></div>
  <div class="meta-row"><div class="meta-label">Submitted At:</div><div class="meta-val">{{.CreatedAtFormatted}}</div></div>
</div>

<div class="section-heading">Form Responses & Submission Answers</div>
<table class="qa-table">
  <thead><tr><th style="width: 40%;">Question / Field</th><th style="width: 60%;">Submitted Response</th></tr></thead>
  <tbody>
    {{range .Responses}}
    <tr><td><strong>{{.Question}}</strong></td><td>{{.Answer}}</td></tr>
    {{end}}
  </tbody>
</table>

<div class="footer">Printed automatically via PintFlow • Job ID: {{.JobID}}</div>
</body>
</html>`

const systemTemplateCompactPass = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>{{.FormTitle}} Pass</title>
<style>
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 15px; color: #0f172a; }
  .box { border: 2px solid #0284c7; border-radius: 8px; padding: 16px; background: #fafafa; max-width: 650px; margin: 0 auto; }
  .top { border-b: 1px solid #e0e0e0; padding-bottom: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
  .top h2 { margin: 0; font-size: 18px; color: #0369a1; text-transform: uppercase; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; }
  .item { background: #ffffff; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 4px; }
  .lbl { font-size: 10px; color: #64748b; font-weight: bold; text-transform: uppercase; }
  .val { font-weight: bold; color: #0f172a; font-size: 12px; }
  .footer-line { font-size: 10px; color: #94a3b8; text-align: center; margin-top: 12px; }
</style>
</head>
<body>
<div class="box">
  <div class="top">
    <h2>{{.FormTitle}}</h2>
    <span style="font-size: 11px; background: #0284c7; color: white; padding: 2px 8px; border-radius: 4px;">PASS</span>
  </div>

  <div class="grid">
    <div class="item"><div class="lbl">Respondent</div><div class="val">{{.UserName}}</div></div>
    <div class="item"><div class="lbl">Email</div><div class="val">{{.UserEmail}}</div></div>
    <div class="item"><div class="lbl">Date</div><div class="val">{{.CreatedAtFormatted}}</div></div>
    <div class="item"><div class="lbl">Job ID</div><div class="val">{{.JobID}}</div></div>
    {{range .Responses}}
    <div class="item"><div class="lbl">{{.Question}}</div><div class="val">{{.Answer}}</div></div>
    {{end}}
  </div>

  <div class="footer-line">PintFlow Compact Pass • Verification Document</div>
</div>
</body>
</html>`

const systemTemplateIDCompliance = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>ID & Security Verification</title>
<style>
  body { font-family: Arial, sans-serif; margin: 30px; color: #1e293b; }
  .container { border: 2px solid #dc2626; border-radius: 8px; padding: 20px; max-width: 800px; margin: 0 auto; }
  .header { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 12px 16px; color: #991b1b; font-weight: bold; font-size: 16px; margin-bottom: 20px; }
  .qa { margin-bottom: 12px; font-size: 13px; }
  .q { font-weight: bold; color: #475569; }
  .a { color: #0f172a; background: #f8fafc; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0; margin-top: 2px; }
  .footer { margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 11px; color: #64748b; text-align: center; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    SECURITY & GUEST ID COMPLIANCE VERIFICATION RECORD
  </div>
  <div style="margin-bottom: 16px; font-size: 13px;">
    <strong>Respondent Name:</strong> {{.UserName}}<br>
    <strong>Email:</strong> {{.UserEmail}}<br>
    <strong>Submission Date:</strong> {{.CreatedAtFormatted}}<br>
    <strong>Job Reference:</strong> {{.JobID}}
  </div>

  <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">Submitted Identification & Verification Data:</div>
  {{range .Responses}}
  <div class="qa">
    <div class="q">{{.Question}}</div>
    <div class="a">{{.Answer}}</div>
  </div>
  {{end}}

  <div class="footer">Verified & Processed by PintFlow Security Module</div>
</div>
</body>
</html>`

