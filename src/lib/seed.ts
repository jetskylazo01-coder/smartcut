import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, addDoc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

const firebaseConfig = {
  apiKey: "AIzaSyDkh-fNS_ATWQEVXo2VPksr5m9WWWL7p9Q",
  authDomain: "smartcutbarber.firebaseapp.com",
  projectId: "smartcutbarber",
  storageBucket: "smartcutbarber.firebasestorage.app",
  messagingSenderId: "335844744671",
  appId: "1:335844744691:web:280b9ec443d5c6937c0686",
};

// Secondary app for creating users without affecting current auth session
let secondaryApp: ReturnType<typeof initializeApp> | null = null;
function getSecondaryAuth() {
  if (!secondaryApp) {
    secondaryApp = initializeApp(firebaseConfig, 'seed-instance');
  }
  return getAuth(secondaryApp);
}

async function createAuthUser(email: string, password: string): Promise<string | null> {
  try {
    const auth = getSecondaryAuth();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await auth.signOut();
    return cred.user.uid;
  } catch (e: any) {
    if (e.code === 'auth/email-already-in-use') return null; // already seeded
    console.warn(`Could not create ${email}:`, e.message);
    return null;
  }
}

export async function seedDatabase(onProgress: (msg: string) => void): Promise<void> {
  onProgress('Creating admin account…');
  const adminUid = await createAuthUser('admin@smartcut.ph', 'Admin@1234');
  if (adminUid) {
    await setDoc(doc(db, 'users', adminUid), { name: 'Admin User', email: 'admin@smartcut.ph', role: 'admin' });
    onProgress('✓ Admin account created');
  } else {
    onProgress('Admin account already exists — skipping');
  }

  onProgress('Creating barber accounts…');
  const barberDefs = [
    { email: 'marco@dailybarber.ph', name: 'Marco Santos', speciality: 'Fade & Taper', phone: '09171234567', rating: 4.9, reviews: 128, photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format', availableSlots: ['09:00','09:30','10:30','11:00','13:00','14:00','15:30','16:00'] },
    { email: 'dante@dailybarber.ph', name: 'Dante Reyes', speciality: 'Classic Cuts', phone: '09182345678', rating: 4.7, reviews: 95, photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&auto=format', availableSlots: ['09:00','10:00','11:30','13:30','14:30','16:00','16:30'] },
    { email: 'alex@dailybarber.ph', name: 'Alex Navarro', speciality: 'Hair Coloring', phone: '09193456789', rating: 4.8, reviews: 112, photo: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&auto=format', availableSlots: ['10:00','10:30','14:00','15:00','15:30'] },
    { email: 'rio@dailybarber.ph', name: 'Rio Castillo', speciality: 'Beard Styling', phone: '09204567890', rating: 4.6, reviews: 78, photo: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&auto=format', availableSlots: ['09:30','10:30','11:30','13:30','14:30','15:30','16:30'] },
  ];

  const barberIds: string[] = [];
  for (const b of barberDefs) {
    const uid = await createAuthUser(b.email, 'Barber@1234');
    const barberDoc = {
      name: b.name, speciality: b.speciality, phone: b.phone,
      email: b.email, photo: b.photo, rating: b.rating, reviews: b.reviews,
      available: true, joinDate: '2023-03-15', completedToday: 0,
      totalCompleted: b.reviews * 10, availableSlots: b.availableSlots,
    };
    const barberRef = await addDoc(collection(db, 'barbers'), barberDoc);
    barberIds.push(barberRef.id);
    if (uid) {
      await setDoc(doc(db, 'users', uid), { name: b.name, email: b.email, role: 'barber', barberId: barberRef.id });
    }
    onProgress(`✓ Barber: ${b.name}`);
  }

  onProgress('Creating services…');
  const services = [
    { name: 'Regular Haircut', description: 'Faded & Precision Haircut w/ Wash & Grooming', category: 'Hair', price: 150, duration: 45, isActive: true },
    { name: 'Ordinary Cut', description: 'Standard haircut service', category: 'Hair', price: 80, duration: 30, isActive: true },
    { name: 'Kapogi Package', description: 'Regular Haircut, Massage w/ Hot Towel, Pomade & Beard Shave', category: 'Package', price: 350, duration: 90, isActive: true },
    { name: 'Quick Shave', description: 'Fast clean shave service', category: 'Beard', price: 50, duration: 15, isActive: true },
    { name: 'Full Beard Shave', description: 'Full beard shave with hot towel treatment', category: 'Beard', price: 100, duration: 30, isActive: true },
    { name: 'Daily Blendz Premium', description: 'Regular Haircut, Full Shave, Facial, Massage w/ Hot Towel', category: 'Package', price: 700, duration: 120, isActive: true },
    { name: 'Braids', description: 'Professional braiding service (minimum)', category: 'Other', price: 600, duration: 120, isActive: true },
    { name: 'Perm / Curl', description: 'Full perm or curl treatment', category: 'Other', price: 1000, duration: 180, isActive: true },
    { name: 'Regular Hair Color', description: 'Single-tone hair coloring', category: 'Other', price: 400, duration: 90, isActive: true },
    { name: 'Fashion Hair Color', description: 'Creative fashion color treatment', category: 'Other', price: 1000, duration: 120, isActive: true },
    { name: 'Ear Cleaning', description: 'Professional ear cleaning with ear candle', category: 'Other', price: 200, duration: 30, isActive: true },
    { name: 'Facial Cleansing', description: 'Facial cleansing with whitehead & blackhead removal', category: 'Other', price: 300, duration: 45, isActive: true },
    { name: 'Scalp Treatment', description: 'Deep scalp treatment and conditioning', category: 'Other', price: 200, duration: 45, isActive: true },
  ];
  for (const s of services) await addDoc(collection(db, 'services'), s);
  onProgress(`✓ ${services.length} services created`);

  onProgress('Creating sample customers…');
  const customerDefs = [
    { email: 'juan@email.com', name: 'Juan dela Cruz', phone: '09151234567', totalVisits: 15, totalSpent: 2850, lastVisit: '2026-06-09', joinDate: '2024-08-01' },
    { email: 'pedro@email.com', name: 'Pedro Reyes', phone: '09162345678', totalVisits: 8, totalSpent: 1500, lastVisit: '2026-06-15', joinDate: '2024-11-12' },
    { email: 'maria@email.com', name: 'Maria Garcia', phone: '09173456789', totalVisits: 12, totalSpent: 3200, lastVisit: '2026-06-10', joinDate: '2024-09-05' },
  ];
  for (const c of customerDefs) {
    const uid = await createAuthUser(c.email, 'Customer@1234');
    if (uid) {
      const tier = c.totalVisits >= 30 ? 'Platinum' : c.totalVisits >= 20 ? 'Gold' : c.totalVisits >= 10 ? 'Silver' : 'Bronze';
      await setDoc(doc(db, 'users', uid), { name: c.name, email: c.email, role: 'customer' });
      await setDoc(doc(db, 'customers', uid), { ...c, id: uid, loyaltyTier: tier, loyaltyPoints: Math.floor(c.totalSpent / 10), visitStreak: 3 });
      onProgress(`✓ Customer: ${c.name}`);
    }
  }

  onProgress('Creating sample reservations…');
  if (barberIds.length > 0) {
    await addDoc(collection(db, 'reservations'), { customerId: 'demo', customer: 'Juan dela Cruz', barberId: barberIds[0], barber: 'Marco Santos', serviceId: 'demo', service: 'Regular Haircut', date: '2026-06-16', time: '09:00', amount: 150, status: 'Confirmed', createdAt: new Date().toISOString() });
    await addDoc(collection(db, 'reservations'), { customerId: 'demo', customer: 'Pedro Reyes', barberId: barberIds[1], barber: 'Dante Reyes', serviceId: 'demo', service: 'Quick Shave', date: '2026-06-16', time: '10:00', amount: 50, status: 'Pending', createdAt: new Date().toISOString() });
    await addDoc(collection(db, 'reservations'), { customerId: 'demo', customer: 'Maria Garcia', barberId: barberIds[0], barber: 'Marco Santos', serviceId: 'demo', service: 'Kapogi Package', date: '2026-06-17', time: '10:30', amount: 350, status: 'Confirmed', createdAt: new Date().toISOString() });
    onProgress('✓ Sample reservations created');
  }

  onProgress('Creating sample transactions…');
  await addDoc(collection(db, 'transactions'), { reservationId: '', customer: 'Jose Santos', barber: 'Rio Castillo', service: 'Full Beard Shave', amount: 100, date: '2026-06-16', time: '12:10', paymentMethod: 'Cash' });
  await addDoc(collection(db, 'transactions'), { reservationId: '', customer: 'Lisa Ramos', barber: 'Alex Navarro', service: 'Fashion Hair Color', amount: 1000, date: '2026-06-15', time: '15:30', paymentMethod: 'GCash' });
  await addDoc(collection(db, 'transactions'), { reservationId: '', customer: 'Pedro Reyes', barber: 'Marco Santos', service: 'Kapogi Package', amount: 350, date: '2026-06-15', time: '11:55', paymentMethod: 'Cash' });
  onProgress('✓ Sample transactions created');

  onProgress('🎉 Database seeded successfully!');
}
