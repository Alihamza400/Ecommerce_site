<?php
// ============================================================
// mail_helper.php — Centralized Email Utility using PHPMailer
// ============================================================

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/mail_config.php';

/**
 * Sends a stylized email using the centralized SMTP settings.
 * 
 * @param string $to Email address of the recipient
 * @param string $name Name of the recipient
 * @param string $subject Subject of the email
 * @param string $body_html HTML content of the email
 * @param string $alt_body Plain text version of the email
 * @return array ['success' => bool, 'message' => string]
 */
function sendMail($to, $name, $subject, $body_html, $alt_body = '') {
    if (SMTP_USER === 'your_username' || empty(SMTP_USER)) {
        return [
            'success' => false, 
            'message' => 'SMTP not configured in mail_config.php.'
        ];
    }

    $mail = new PHPMailer(true);

    try {
        // Server settings
        $mail->isSMTP();
        $mail->Host       = SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = SMTP_USER;
        $mail->Password   = SMTP_PASS;
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = SMTP_PORT;

        // Recipients
        $mail->setFrom(SMTP_FROM, SMTP_FROM_NAME);
        $mail->addAddress($to, $name);

        // Content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $body_html;
        $mail->AltBody = $alt_body ?: strip_tags($body_html);

        $mail->send();
        return ['success' => true, 'message' => 'Email sent successfully.'];
    } catch (Exception $e) {
        return [
            'success' => false, 
            'message' => "Mailer Error: {$mail->ErrorInfo}"
        ];
    }
}
?>
