const crypto = require('crypto');

// Inputs from user's message
const WEBHOOK_SECRET = 'Mp5d...cny8'; // Wait, I need the actual secret. 
// I will just use the one from .env since I have access to it.
require('dotenv').config({ path: './functions/.env' });
const secret = process.env.DIDIT_WEBHOOK_SECRET;

const rawBody = `{"session_id":"eb1d3497-3c72-449d-9f23-bca4583336ed","status":"Approved","vendor_data":"test-vendor-data-123","webhook_type":"status.updated","timestamp":1771730500,"created_at":1771730500,"workflow_id":"fd4d7f2b-5d95-4042-b4a3-3f9bed3e2228","metadata":{"test_webhook":true},"decision":{"session_id":"eb1d3497-3c72-449d-9f23-bca4583336ed","session_number":12345,"session_url":"https://verify.didit.me/session/_W3wrYjRQPeN","status":"Approved","workflow_id":"fd4d7f2b-5d95-4042-b4a3-3f9bed3e2228","features":["ID_VERIFICATION","LIVENESS","FACE_MATCH","AML"],"vendor_data":"test-vendor-data-123","metadata":{"test_webhook":true},"callback":"https://example.com/callback","id_verifications":[{"status":"Approved","full_name":"John Michael Smith","first_name":"John Michael","last_name":"Smith","date_of_birth":"1988-03-15","document_type":"Driver's License","document_number":"D1234567890","issuing_state":"USA","issuing_state_name":"United States","nationality":"USA","expiration_date":"2028-03-15","date_of_issue":"2020-03-15","age":36,"gender":"M","address":"123 Main Street, Apt 4B, New York, NY 10001","formatted_address":null,"place_of_birth":"Los Angeles","personal_number":null,"marital_status":"UNKNOWN","parsed_address":{"street_1":"123 Main Street","street_2":"Apt 4B","city":"New York","region":"NY","postal_code":"10001","country":"USA"},"front_image":"https://cdn.didit.me/test/dfbeaa88-ddce-46d4-9bb5-6cbfeef1b2a7/front.jpg","back_image":"https://cdn.didit.me/test/dfbeaa88-ddce-46d4-9bb5-6cbfeef1b2a7/back.jpg","portrait_image":"https://cdn.didit.me/test/dfbeaa88-ddce-46d4-9bb5-6cbfeef1b2a7/portrait.jpg","full_front_image":"https://cdn.didit.me/test/dfbeaa88-ddce-46d4-9bb5-6cbfeef1b2a7/full_front.jpg","full_back_image":"https://cdn.didit.me/test/dfbeaa88-ddce-46d4-9bb5-6cbfeef1b2a7/full_back.jpg","front_video":null,"back_video":null,"front_image_camera_front":null,"back_image_camera_front":null,"front_image_camera_front_face_match_score":null,"back_image_camera_front_face_match_score":null,"extra_fields":{"dl_categories":["C","D"],"reference_number":"842309925"},"extra_files":[],"warnings":[],"node_id":"node-id-verification-1"}],"nfc_verifications":null,"liveness_checks":[{"status":"Approved","liveness_score":0.98,"face_image":"https://cdn.didit.me/test/6571525d-3ba0-4b15-ae07-1892cda3cd15/liveness.jpg","node_id":"node-liveness-1"}],"face_matches":[{"status":"Approved","face_match_score":0.94,"similarity_percentage":94,"node_id":"node-face-match-1"}],"poa_verifications":null,"phone_verifications":null,"email_verifications":null,"aml_screenings":[{"status":"Approved","total_hits":0,"screened_data":{"full_name":"John Michael Smith","date_of_birth":"1988-03-15"},"hits":[],"is_ongoing_monitoring_enabled":false,"ongoing_monitoring_last_check":null,"node_id":"node-aml-1"}],"ip_analyses":[{"ip_address":"85.123.45.67","country":"ESP","country_name":"Spain","city":"Madrid","region":"Community of Madrid","latitude":40.4168,"longitude":-3.7038,"is_vpn":false,"is_proxy":false,"is_tor":false,"is_datacenter":false,"risk_score":5,"node_id":"node-ip-analysis-1"}],"database_validations":null,"questionnaire_responses":null,"reviews":[{"user":"admin@company.com","new_status":"Approved","comment":null,"created_at":"2024-01-15T10:35:00.000000Z"}],"contact_details":null,"expected_details":null,"created_at":"2024-01-15T10:30:00.000000Z"}}`;
// Note: stringified JSON changes format slightly from original raw. Let's just test HMAC functions
const timestamp = '1771730500';

function testHmac(payload, name) {
    const hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    console.log(name, hash);
}

// 1. Raw body only
testHmac(rawBody, "Raw");

// 2. Timestamp + Raw body
testHmac(timestamp + rawBody, "Timestamp+Raw");

// 3. Timestamp + . + Raw body
testHmac(timestamp + '.' + rawBody, "Timestamp.Raw");

// 4. v2 version payload format?
console.log('Expected: 6a758a692130671abde061fc79fc7fc297f6c451d0a514d665626f0b5c426607');
