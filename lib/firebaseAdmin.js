const admin = require("firebase-admin");

let app;

const parseServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    return null;
  }

  const serviceAccount = JSON.parse(raw);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  return serviceAccount;
};

const getFirebaseApp = () => {
  if (app) {
    return app;
  }

  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
  if (!storageBucket) {
    return null;
  }

  const serviceAccount = parseServiceAccount();
  app = admin.initializeApp({
    credential: serviceAccount
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    storageBucket,
  });

  return app;
};

const getFirebaseServices = () => {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    return null;
  }

  return {
    firestore: admin.firestore(firebaseApp),
    bucket: admin.storage(firebaseApp).bucket(),
  };
};

module.exports = {
  getFirebaseServices,
};
