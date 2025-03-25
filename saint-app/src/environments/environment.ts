// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
    // URL_LOGIN : 'http://localhost:8080',
    // URL_ERP_INTEGRATION : 'http://localhost:9001',
    // URL_TECHNICAL_DATA_SHEET : 'http://localhost:9000'
    URL_REPORT_TECHNICAL_DATA_SHEETS : 'https://providenciacfi.com/api_technical_data_sheet_service.php',
    URL_LOGIN : 'https://lb.protejer.com',
    URL_ERP_INTEGRATION : 'https://lb.protejer.com',
    URL_TECHNICAL_DATA_SHEET : 'https://lb.protejer.com'
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
