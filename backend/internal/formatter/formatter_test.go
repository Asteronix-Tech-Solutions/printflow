package formatter

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"pintflow/backend/internal/models"
)

func TestGenerateFormSummaryPDF(t *testing.T) {
	fmtEngine := NewFormatter()
	tempDir := t.TempDir()
	pdfPath := filepath.Join(tempDir, "test_form_summary.pdf")

	job := &models.Job{
		ID:        "job_test_pdf_001",
		FormTitle: "Hotel Villa Guest Check-in Form",
		UserName:  "Ashik Test",
		UserEmail: "ashik@example.com",
		CreatedAt: time.Now(),
		TemplateID: "property_checkin",
		FormResponses: []models.FormQuestionAnswer{
			{Question: "Which Property Have you Booked?", Answer: "Villa Sunrise - Beachfront Resort"},
			{Question: "Phone", Answer: "+1 (555) 019-2831"},
			{Question: "Check-in Date", Answer: "2026-08-01"},
			{Question: "Check-out Date", Answer: "2026-08-07"},
			{Question: "Purpose of Visit", Answer: "Vacation"},
			{Question: "My/Our Martial Status is", Answer: "Married"},
			{Question: "Guest Selection", Answer: "2 Guests"},
			{Question: "Name of Guest 1", Answer: "Ashik Test"},
			{Question: "Ages", Answer: "32"},
			{Question: "Guest 1 Gender", Answer: "Male"},
			{Question: "Name of Guest 2", Answer: "Jane Test"},
			{Question: "Guest 2 Gender", Answer: "Female"},
			{Question: "Upload photos ID for all Guests", Answer: "Aadhar_Card_Verified.pdf"},
			{Question: "Statement Of Responsibility", Answer: "Accepted"},
		},
	}

	err := fmtEngine.GenerateFormSummaryPDF(job, pdfPath)
	if err != nil {
		t.Fatalf("GenerateFormSummaryPDF failed: %v", err)
	}

	info, err := os.Stat(pdfPath)
	if err != nil {
		t.Fatalf("PDF file was not created on disk: %v", err)
	}

	if info.Size() < 100 {
		t.Fatalf("Generated PDF file size is suspiciously small: %d bytes", info.Size())
	}
}

func TestGeneratePDFBytesAllTemplates(t *testing.T) {
	fmtEngine := NewFormatter()
	job := &models.Job{
		ID:        "job_test_all_templates",
		FormTitle: "General Google Form Submission",
		UserName:  "John Respondent",
		UserEmail: "john@example.com",
		CreatedAt: time.Now(),
		FormResponses: []models.FormQuestionAnswer{
			{Question: "Full Name", Answer: "John Respondent"},
			{Question: "Department", Answer: "Engineering"},
		},
	}

	templates := []string{"property_checkin", "default"}
	for _, tmplID := range templates {
		bytes, err := fmtEngine.GeneratePDFBytes(job, tmplID)
		if err != nil {
			t.Errorf("GeneratePDFBytes failed for template '%s': %v", tmplID, err)
		}
		if len(bytes) == 0 {
			t.Errorf("GeneratePDFBytes returned empty bytes for template '%s'", tmplID)
		}
	}
}
