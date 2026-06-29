import { collection, addDoc, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

/**
 * All services from the Daily Barber Hair Studio menu poster.
 * Ordinary Cut has no printed price — set to ₱100 as default.
 */
export const DAILY_BARBER_SERVICES = [
  // ── Daily Services ──────────────────────────────────────────────────────────
  {
    name: 'Regular Haircut',
    description: 'Faded & Precision Haircut w/ Wash & Grooming',
    category: 'Daily',
    price: 150,
    duration: 45,
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Ordinary Cut',
    description: 'Standard everyday haircut',
    category: 'Daily',
    price: 100,
    duration: 30,
    isActive: true,
    sortOrder: 2,
  },
  {
    name: 'Kapogi Package',
    description: 'Regular Haircut, Massage w/ Hot Towel, Pomade & Beard Shave',
    category: 'Package',
    price: 350,
    duration: 90,
    isActive: true,
    sortOrder: 3,
  },
  {
    name: 'Quick Shave',
    description: 'Fast and clean shave service',
    category: 'Daily',
    price: 50,
    duration: 15,
    isActive: true,
    sortOrder: 4,
  },
  {
    name: 'Full Beard Shave',
    description: 'Full beard shave with hot towel treatment',
    category: 'Daily',
    price: 100,
    duration: 30,
    isActive: true,
    sortOrder: 5,
  },
  {
    name: 'Daily Blendz Premium',
    description: 'Regular Haircut, Full Shave, Facial, Massage w/ Hot Towel',
    category: 'Package',
    price: 700,
    duration: 120,
    isActive: true,
    sortOrder: 6,
  },
  // ── Other Offered Services ───────────────────────────────────────────────────
  {
    name: 'Braids',
    description: 'Professional braiding service (minimum)',
    category: 'Other',
    price: 600,
    duration: 120,
    isActive: true,
    sortOrder: 7,
  },
  {
    name: 'Perm / Curl',
    description: 'Full perm or curl treatment',
    category: 'Other',
    price: 1000,
    duration: 180,
    isActive: true,
    sortOrder: 8,
  },
  {
    name: 'Regular Hair Color',
    description: 'Single-tone hair coloring treatment',
    category: 'Other',
    price: 400,
    duration: 90,
    isActive: true,
    sortOrder: 9,
  },
  {
    name: 'Fashion Hair Color',
    description: 'Creative fashion color treatment',
    category: 'Other',
    price: 1000,
    duration: 120,
    isActive: true,
    sortOrder: 10,
  },
  {
    name: 'Ear Cleaning',
    description: 'Professional ear cleaning with ear candle',
    category: 'Other',
    price: 200,
    duration: 30,
    isActive: true,
    sortOrder: 11,
  },
  {
    name: 'Facial Cleansing',
    description: 'Facial cleansing with whitehead & blackhead removal',
    category: 'Other',
    price: 300,
    duration: 45,
    isActive: true,
    sortOrder: 12,
  },
  {
    name: 'Scalp Treatment',
    description: 'Deep scalp treatment and conditioning',
    category: 'Other',
    price: 200,
    duration: 45,
    isActive: true,
    sortOrder: 13,
  },
];

/**
 * Clears the existing services collection and writes all menu services
 * to Firestore. Called from the Admin panel.
 */
export async function seedServices(
  onProgress: (msg: string) => void,
  replace = true,
): Promise<void> {
  if (replace) {
    onProgress('Clearing existing services…');
    const snap = await getDocs(collection(db, 'services'));
    if (snap.docs.length > 0) {
      const batch = writeBatch(db);
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      onProgress(`Removed ${snap.docs.length} existing service(s).`);
    }
  }

  onProgress('Writing services to Firestore…');
  for (const svc of DAILY_BARBER_SERVICES) {
    await addDoc(collection(db, 'services'), svc);
    onProgress(`✓ ${svc.name} — ₱${svc.price}`);
  }

  onProgress(`🎉 All ${DAILY_BARBER_SERVICES.length} services saved to Firestore!`);
}
