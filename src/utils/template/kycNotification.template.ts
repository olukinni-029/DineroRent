export const kycNotificationTemplate = (data: {
  vendorName: string;
  vendorEmail: string;
  businessName?: string;
  submittedAt: Date;
}) => {
  const { vendorName, vendorEmail, businessName, submittedAt } = data;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New KYC Submission Notification</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #f8f9fa;
          padding: 20px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        .content {
          background-color: #ffffff;
          padding: 20px;
          border: 1px solid #dee2e6;
          border-radius: 5px;
        }
        .footer {
          margin-top: 20px;
          font-size: 12px;
          color: #6c757d;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>New KYC Submission</h2>
      </div>
      <div class="content">
        <p>Dear Admin,</p>
        <p>A new KYC submission has been received and requires your review.</p>
        <ul>
          <li><strong>Vendor Name:</strong> ${vendorName}</li>
          <li><strong>Vendor Email:</strong> ${vendorEmail}</li>
          ${businessName ? `<li><strong>Business Name:</strong> ${businessName}</li>` : ''}
          <li><strong>Submitted At:</strong> ${submittedAt.toLocaleString()}</li>
        </ul>
        <p>Please log in to the admin panel to review and approve or reject this KYC submission.</p>
        <p>Best regards,<br>DineroRent Team</p>
      </div>
      <div class="footer">
        <p>This is an automated notification. Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;

  return html;
};
