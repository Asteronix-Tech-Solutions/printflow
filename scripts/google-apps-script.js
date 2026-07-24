/**
 * ==============================================================================
 * PintFlow - Automatic Google Form Printing System
 * Production Google Apps Script Trigger Script with Form Formatting
 * ==============================================================================
 *
 * HOW TO INSTALL:
 * 1. Open your Google Form.
 * 2. Click the three dots (⋮) in top right -> Script editor.
 * 3. Paste this code into Code.gs.
 * 4. Update WEBHOOK_URL and WEBHOOK_SECRET below with your server credentials.
 * 5. Click Triggers (alarm clock icon on left sidebar) -> Add Trigger:
 *    - Function: onFormSubmit
 *    - Deployment: Head
 *    - Event source: From form
 *    - Event type: On form submit
 * 6. Save and authorize permissions.
 */

// CONFIGURATION
var WEBHOOK_URL = "https://your-pintflow-domain.com/api/v1/webhook"; // Or http://YOUR_SERVER_IP:8080/api/v1/webhook
var WEBHOOK_SECRET = "pintflow_secret_token_123";
var DEFAULT_PRINTER = "Brother_DCP_T430W";

function onFormSubmit(e) {
  if (!e) {
    Logger.log("No event object passed to onFormSubmit");
    return;
  }

  var form = FormApp.getActiveForm();
  var formTitle = form ? form.getTitle() : "Google Form Submission";

  var formResponse = e.response;
  var itemResponses = formResponse.getItemResponses();

  var respondentEmail = formResponse.getRespondentEmail() || "";
  var respondentName = "";
  var uploadedFileIds = [];
  var formQA = [];

  for (var i = 0; i < itemResponses.length; i++) {
    var itemResponse = itemResponses[i];
    var questionTitle = itemResponse.getItem().getTitle();
    var rawAnswer = itemResponse.getResponse();
    var answerString = "";

    if (Array.isArray(rawAnswer)) {
      answerString = rawAnswer.join(", ");
    } else {
      answerString = String(rawAnswer || "");
    }

    // Capture Respondent Name if asked in form
    var lowerTitle = questionTitle.toLowerCase();
    if (lowerTitle.indexOf("name") !== -1 || lowerTitle.indexOf("full name") !== -1) {
      if (!respondentName) respondentName = answerString;
    }

    // Capture File Upload Responses
    if (itemResponse.getItem().getType() === FormApp.ItemType.FILE_UPLOAD) {
      if (Array.isArray(rawAnswer)) {
        for (var j = 0; j < rawAnswer.length; j++) {
          uploadedFileIds.push(rawAnswer[j]);
        }
      } else if (typeof rawAnswer === "string") {
        uploadedFileIds.push(rawAnswer);
      }
    } else {
      // Add standard Q&A to form summary sheet
      formQA.push({
        question: questionTitle,
        answer: answerString
      });
    }
  }

  // If attachments exist, queue each attached file with the form summary attached!
  if (uploadedFileIds.length > 0) {
    for (var k = 0; k < uploadedFileIds.length; k++) {
      var fileId = uploadedFileIds[k];
      var filename = "Form_Upload_" + (k + 1) + ".pdf";

      try {
        var file = DriveApp.getFileById(fileId);
        if (file) {
          filename = file.getName();
        }
      } catch (err) {
        Logger.log("Could not fetch file metadata for fileId: " + fileId + ": " + err);
      }

      var payload = {
        secret: WEBHOOK_SECRET,
        response_id: formResponse.getId(),
        user_name: respondentName || respondentEmail || "Form Respondent",
        user_email: respondentEmail,
        file_id: fileId,
        filename: filename,
        printer: DEFAULT_PRINTER,
        copies: 1,
        form_title: formTitle,
        form_responses: formQA
      };

      sendWebhookPayload(payload);
    }
  } else {
    // If no attachments, queue the formatted Google Form response sheet for printing!
    var payloadOnlyForm = {
      secret: WEBHOOK_SECRET,
      response_id: formResponse.getId(),
      user_name: respondentName || respondentEmail || "Form Respondent",
      user_email: respondentEmail,
      file_id: "",
      filename: "form_response_summary.pdf",
      printer: DEFAULT_PRINTER,
      copies: 1,
      form_title: formTitle,
      form_responses: formQA
    };

    sendWebhookPayload(payloadOnlyForm);
  }
}

function sendWebhookPayload(payload) {
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    Logger.log("PintFlow Webhook Response (" + response.getResponseCode() + "): " + response.getContentText());
  } catch (err) {
    Logger.log("Error posting to PintFlow webhook: " + err);
  }
}
