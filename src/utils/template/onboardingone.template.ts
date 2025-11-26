export const onboardingOneTemplate= async ( otp: string) => {
  const html = `<!DOCTYPE html>
        <html lang="en">

        <head>
            <meta charset="UTF-8">
            <meta http-equiv="X-UA-Compatible" content="IE=edge">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title></title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                :root { --logo-color: #121F3E; }
                body { font-size: 16px;
            margin: auto;
            font-family: sans-serif;
            color: #333333;
        }

        .main {
            max-width: 640px;
            margin: auto;
            padding: 16px 32px;
            background-color: #F8F8F8;
        }
        .header {
                background-color: #F8F8F8;
                padding: 10px;
                text-align: center;
            }

            .header img {
                height: 30px;
            }

        .footer {
                    max-width: 640px;
                    background-color: #121F3E;
                    font-size: 16px;
                    padding: 16px 24px;
                    color: #475467;
                }

        .welcome {
                    padding: 32px 32px 64px;
                    color: #344054;
                }

                .subject {
                    color: #333333;
                }

        a {
            color: #121F3E;
            text-decoration: none;
        }

        .handles {
            width: 100px;
        }

        .button {
                    background-color: #121F3E;
                    border-color: #121F3E;
                    border-style: solid;
                    color: white;
                }

                .button:hover {
                    color: white;
                    background-color: #121F3E;
                }
                .footer {
                padding: 10px;
                background-color: #121F3E;
                font-size: 18px;
                color: #FFFFFF;
                text-align: center;
            }


        @media (max-width: 560px) {
            .welcome {
                padding-left: 16px;
                padding-right: 16px;
            }
            .footer {
                padding-left: 16px;
                padding-right: 16px;
            }
        }

            </style>
        </head>

        <body>
            <div class="main container-md">
                <header class="header py-2">
                    <div class="header">
                        <img
                        src="https://res.cloudinary.com/dghrve7zl/image/upload/f_png,q_auto/v1760521505/logo_onrtes.svg"
                        alt="DineroRent Logo"
                        width="180"
                        style="display:block;border:0;outline:none;text-decoration:none;height:auto;margin:0 auto;"
                        />
                    </div>
                </header>
                <div class="welcome bg-white rounded-3">
                        <div class="intro">
                        <p> Your DineroRent verification code is: <b>${otp}</b></p>
                            <p>This code will expire in 10 minutes. If you did not request this code, please ignore this email.</p>
                            <p>If you have any questions or need assistance, feel free to contact our support team at <a href="mailto:info@supplysmart.co">info@supplysmart.co</a>.</p>
                            <p>Regards,</p>
                            <p>DineroRent Team.</p>
                        </div>
                </div>
                <footer class="footer m-auto">
                    <div class="footer">
                        &copy; DineroRent. All rights reserved.
                        <br />
                        
                    </div>
                </footer>

            </div>

        </body>

        </html>
`;
  return html;
};

