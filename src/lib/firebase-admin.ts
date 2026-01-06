import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import type { Bucket } from '@google-cloud/storage';

import serviceAccount from '../Secret/firebase-service-account.json' with { type: "json" };

initializeApp({
  credential: cert(serviceAccount as ServiceAccount),
  storageBucket: 'gs://testing-b3628.appspot.com', // 🔁 Replace this
});

export const bucket: Bucket = getStorage().bucket();
