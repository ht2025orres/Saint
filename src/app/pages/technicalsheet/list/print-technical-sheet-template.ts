export const HTML_HEAD = `
        <link rel="stylesheet"
        href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css"
        integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
        <style>
            html, body, h1, h2, h3, h4, p, img { margin: 0;} /* margin reset*/
            h1{font-size: 18pt; font-weight: 500; margin-bottom: 0.5cm;}
            h2{font-size: 16pt; font-weight: 500;}
            p{font-size: 14pt;}

            .salto_pagina_despues{
            page-break-after:always;
            }

            .salto_pagina_anterior{
            page-break-before:always;
            }

            .content {
            height: 100vh;
            width: 100%;
            display: flex;
            flex-direction: column;
            }

            .img-content {
            flex: 1;
            display: flex;
            justify-content: center;
            align-items: center;
            }

            .observation {
            height: 150px;
            overflow: hidden;
            overflow-y: auto;
            }

            .fondo-info {
            background-color: #3F51B5; !important;
            }
            .footer {
                position: fixed;
                left: 0;
                bottom: 0;
                width: 100%;
                background-color: #3F51B5;
                color: white;
              }
            @media print and (color) {
             * {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
             }
                script, style { 
                    display:none; 
                }
                div {
                    page-break-inside:avoid;
                }
            }
            .color-adjust: exact;
            .-webkit-print-color-adjust: exact;
        </style>
    </head>
`;

export const HTML_FOOTER = `
<div class="footer" style="heigth:100px;">
    <div class="row">
        <div class="col-md-3 " style="display:flex; position:absolute; justify-content:start;  text-aling:center; "  >
            <img src="../../../../assets/images/logoProtejer.png" alt="footer-document" width="20% heigth="20%"" 
            class="img-responsive " />
        </div>
        <div class="col-md-7 text-center ">
            <p><small>Km 34 vía central Cali - El Cerrito, Corregimiento El Placer <br />
            PBX: (57) (2) 255 52 21 Ext: 171 1 – Móvil 318 3122794<br />
            contactanos@protejer.com</small></p>
        </div>
        <div class="col-md-2 text-center mt-2" style="display:flex; bottom:100%; top:0; position:absolute; justify-content:end;  text-aling:center; ">
            <p><strong>CO-FT-04</strong><br/>
            <small>Versión ficha: 0</small></p>                                
        </div>
    </div>
</div>
`;

