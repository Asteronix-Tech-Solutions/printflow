/**
 * PintFlow - Automatic Google Form Printing System
 */

// CONFIGURATION
var WEBHOOK_URL = "https://localhost:8080/api/v1/webhook";
var WEBHOOK_SECRET = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

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
  var uploadedFiles = [];  // Array of {file_name, file_data, question_title}
  var formQA = [];
  var primaryFilename = "form_response_summary.pdf";

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

    var lowerTitle = questionTitle.toLowerCase();
    if (lowerTitle.indexOf("name") !== -1 || lowerTitle.indexOf("full name") !== -1) {
      if (!respondentName) respondentName = answerString;
    }

    if (itemResponse.getItem().getType() === FormApp.ItemType.FILE_UPLOAD) {
      var fileIds = Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer];
      for (var j = 0; j < fileIds.length; j++) {
        var fileId = cleanDriveFileId(fileIds[j]);
        var filename = "Form_Upload_" + (uploadedFiles.length + 1) + ".pdf";
        var fileDataBase64 = "";

        try {
          var file = DriveApp.getFileById(fileId);
          if (file) {
            filename = file.getName();
            var fileBlob = file.getBlob();
            if (fileBlob.getBytes().length < 15 * 1024 * 1024) {
              fileDataBase64 = "data:" + fileBlob.getContentType() + ";base64," + Utilities.base64Encode(fileBlob.getBytes());
            }
          }
        } catch (err) {
          Logger.log("Could not fetch file blob for fileId: " + fileId + ": " + err);
        }

        uploadedFiles.push({
          file_name: filename,
          file_data: fileDataBase64,
          question_title: questionTitle
        });

        // Use the first uploaded file as the primary filename
        if (uploadedFiles.length === 1) {
          primaryFilename = filename;
        }
      }
    } else {
      formQA.push({
        question: questionTitle,
        answer: answerString
      });
    }
  }

  // Send ONE webhook per form submission with ALL files bundled
  var payload = {
    secret: WEBHOOK_SECRET,
    response_id: formResponse.getId(),
    user_name: respondentName || respondentEmail || "Form Respondent",
    user_email: respondentEmail,
    file_id: "",
    filename: primaryFilename,
    copies: 1,
    form_title: formTitle,
    form_responses: formQA
  };

  // Attach file data - first file goes in file_data, all files in files_data array
  if (uploadedFiles.length > 0) {
    payload.file_data = uploadedFiles[0].file_data;
    payload.files_data = [];
    for (var f = 0; f < uploadedFiles.length; f++) {
      payload.files_data.push({
        file_name: uploadedFiles[f].file_name,
        file_data: uploadedFiles[f].file_data,
        question_title: uploadedFiles[f].question_title
      });
    }
  }

  sendWebhookPayload(payload);
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

/**
 * MANUAL REPLAY HELPERS:
 * Select 'replayLastSubmission' in top dropdown and click Run to re-send the most recent submission.
 */
function replayLastSubmission() {
  replayRecentResponses(1);
}

function replayRecentResponses(count) {
  var targetCount = count || 1;
  var form = FormApp.getActiveForm();
  var responses = form.getResponses();
  if (!responses || responses.length === 0) {
    Logger.log("No past form responses found.");
    return;
  }

  var startIndex = Math.max(0, responses.length - targetCount);
  Logger.log("Replaying last " + (responses.length - startIndex) + " submission(s)...");

  for (var i = startIndex; i < responses.length; i++) {
    var response = responses[i];
    Logger.log("Replaying submission #" + (i + 1) + " (ID: " + response.getId() + ")...");
    onFormSubmit({ response: response });
  }
}

function cleanDriveFileId(input) {
  if (!input) return "";
  var str = String(input).trim();
  if (str.indexOf("/d/") !== -1) {
    var parts = str.split("/d/");
    if (parts.length > 1) {
      return parts[1].split("/")[0].split("?")[0];
    }
  }
  if (str.indexOf("id=") !== -1) {
    var parts = str.split("id=");
    if (parts.length > 1) {
      return parts[1].split("&")[0];
    }
  }
  return str;
}
