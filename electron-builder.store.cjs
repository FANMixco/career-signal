const basePackage = require("./package.json");

const requiredStoreVars = [
  "WINDOWS_STORE_IDENTITY_NAME",
  "WINDOWS_STORE_PUBLISHER",
  "WINDOWS_STORE_PUBLISHER_DISPLAY_NAME",
];

const missingStoreVars = requiredStoreVars.filter((name) => !process.env[name]);

if (missingStoreVars.length > 0) {
  throw new Error(
    `Missing Microsoft Store package identity values: ${missingStoreVars.join(", ")}. ` +
      "Copy them from Partner Center > Product identity before building the Store package.",
  );
}

const baseBuild = basePackage.build;

module.exports = {
  ...baseBuild,
  win: {
    ...baseBuild.win,
    target: ["appx"],
  },
  appx: {
    identityName: process.env.WINDOWS_STORE_IDENTITY_NAME,
    applicationId: process.env.WINDOWS_STORE_APPLICATION_ID || "CareerSignalEngine",
    publisher: process.env.WINDOWS_STORE_PUBLISHER,
    publisherDisplayName: process.env.WINDOWS_STORE_PUBLISHER_DISPLAY_NAME,
    displayName: process.env.WINDOWS_STORE_DISPLAY_NAME || baseBuild.productName,
    backgroundColor: "#f7f5ef",
    languages: ["en-US"],
    showNameOnTiles: false,
  },
};
