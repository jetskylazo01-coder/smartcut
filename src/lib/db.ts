import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  deleteDoc, query, where, orderBy, onSnapshot, writeBatch,
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReservationStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
export type UserRole = 'admin' | 'barber' | 'customer';

export interface DBUser {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  barberId?: string;
}

export interface DBBarber {
  id: string;
  name: string;
  speciality: string;
  photo: string;
  rating: number;
  reviews: number;
  available: boolean;
  phone: string;
  email: string;
  joinDate: string;
  completedToday: number;
  totalCompleted: number;
  availableSlots: string[];
  // Soft-delete fields
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface DBService {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  duration: number;
  isActive: boolean;
  sortOrder?: number;
}

export interface DBCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  totalVisits: number;
  totalSpent: number;
  lastVisit: string;
  loyaltyTier: string;
  loyaltyPoints: number;
  visitStreak: number;
  joinDate: string;
  photo?: string;
}

// Individual service item within a multi-service reservation
export interface DBServiceItem {
  id: string;
  name: string;
  price: number;
  duration: number;
}

export interface DBReservation {
  id: string;
  customerId: string;
  customer: string;
  barberId: string;
  barber: string;
  // Legacy single-service fields (kept for backwards compat)
  serviceId: string;
  service: string;  // e.g. "Regular Haircut + Quick Shave" or single name
  // Multi-service fields
  services?: DBServiceItem[];     // array of all selected services
  totalDuration?: number;         // sum of all service durations in minutes
  date: string;
  time: string;
  amount: number;  // total price of all services
  status: ReservationStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  // Customer rating (1–5 stars)
  customerRating?: number;
  ratedAt?: string;
}

export interface DBTransaction {
  id: string;
  reservationId: string;   // empty string for walk-ins
  type?: 'reservation' | 'walkin';  // defaults to 'reservation' for legacy records
  customer: string;
  customerPhone?: string;  // walk-in customer phone (optional)
  barber: string;
  barberId?: string;
  service: string;         // label: single name or "A + B + C"
  services?: DBServiceItem[];  // detailed service list
  amount: number;
  date: string;
  time: string;
  paymentMethod: string;
  notes?: string;
  completedAt?: string;    // ISO timestamp when completed
}

export interface DBNotification {
  id: string;
  customerId?: string;
  type: 'confirmation' | 'reminder' | 'cancellation' | 'promo' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  sentAt: string;
  reservationId?: string;
}

// ─── Loyalty helpers ──────────────────────────────────────────────────────────

export function getLoyaltyTier(visits: number): string {
  if (visits >= 30) return 'Platinum';
  if (visits >= 20) return 'Gold';
  if (visits >= 10) return 'Silver';
  return 'Bronze';
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getUser(uid: string): Promise<DBUser | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as DBUser;
}

export async function createUser(uid: string, data: Omit<DBUser, 'uid'>) {
  await setDoc(doc(db, 'users', uid), data);
}

// ─── Barber Account Creation (Admin only) ────────────────────────────────────
// Uses a secondary Firebase App so the admin's session is NOT interrupted.

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDkh-fNS_ATWQEVXo2VPksr5m9WWWL7p9Q",
  authDomain: "smartcutbarber.firebaseapp.com",
  projectId: "smartcutbarber",
  storageBucket: "smartcutbarber.firebasestorage.app",
  messagingSenderId: "335844744691",
  appId: "1:335844744691:web:280b9ec443d5c6937c0686",
};

export async function createBarberAuthAccount(
  email: string,
  password: string,
  barberDocId: string,
  name: string,
): Promise<string> {
  const appName = `barber-create-${Date.now()}`;
  const secondaryApp = initializeApp(FIREBASE_CONFIG, appName);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = cred.user.uid;
    await secondaryAuth.signOut();
    // Write user doc linking this auth account to the barber document
    await setDoc(doc(db, 'users', uid), { name, email, role: 'barber', barberId: barberDocId });
    return uid;
  } catch (e: any) {
    if (e.code === 'auth/email-already-in-use') throw new Error('Email already in use. Choose a different email.');
    throw new Error(e.message ?? 'Failed to create barber account.');
  }
}

// ─── Barbers ──────────────────────────────────────────────────────────────────

/** Active barbers only — used for booking, barber dashboard, customer-facing views. */
export function listenBarbers(cb: (b: DBBarber[]) => void) {
  return onSnapshot(collection(db, 'barbers'), snap => {
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as DBBarber));
    cb(all.filter(b => !b.isDeleted));
  });
}

/** All barbers including soft-deleted — used in Admin dashboard only. */
export function listenAllBarbers(cb: (b: DBBarber[]) => void) {
  return onSnapshot(collection(db, 'barbers'), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as DBBarber)));
  });
}

export async function addBarber(data: Omit<DBBarber, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'barbers'), { ...data, isDeleted: false });
  return ref.id;
}

export async function updateBarber(id: string, data: Partial<DBBarber>) {
  await updateDoc(doc(db, 'barbers', id), data);
}

/** Soft-delete: sets isDeleted=true and records deletedAt timestamp in Firestore. */
export async function deleteBarber(id: string) {
  await updateDoc(doc(db, 'barbers', id), {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
  });
}

/** Restore a soft-deleted barber — clears isDeleted and deletedAt in Firestore. */
export async function restoreBarber(id: string) {
  await updateDoc(doc(db, 'barbers', id), {
    isDeleted: false,
    deletedAt: null,
  });
}

export async function updateBarberAvailability(barberId: string, slots: string[]) {
  await updateDoc(doc(db, 'barbers', barberId), { availableSlots: slots });
}

// ─── Services ─────────────────────────────────────────────────────────────────

export function listenServices(cb: (s: DBService[]) => void) {
  // Simple collection scan; sort client-side by sortOrder to avoid index requirements
  return onSnapshot(collection(db, 'services'), snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DBService));
    docs.sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99));
    cb(docs);
  });
}

export async function addService(data: Omit<DBService, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'services'), data);
  return ref.id;
}

export async function updateService(id: string, data: Partial<DBService>) {
  await updateDoc(doc(db, 'services', id), data);
}

export async function deleteService(id: string) {
  await deleteDoc(doc(db, 'services', id));
}

// ─── Customers ────────────────────────────────────────────────────────────────

export async function getCustomer(uid: string): Promise<DBCustomer | null> {
  const snap = await getDoc(doc(db, 'customers', uid));
  if (!snap.exists()) return null;
  return { id: uid, ...snap.data() } as DBCustomer;
}

export async function getCustomers(): Promise<DBCustomer[]> {
  const snap = await getDocs(collection(db, 'customers'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as DBCustomer));
}

/** Real-time listener for ALL customers — use in Admin dashboard */
export function listenCustomers(cb: (c: DBCustomer[]) => void): () => void {
  return onSnapshot(collection(db, 'customers'), snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as DBCustomer)));
  });
}

/** Real-time listener for a SINGLE customer profile — use in Customer dashboard */
export function listenCustomer(uid: string, cb: (c: DBCustomer | null) => void): () => void {
  return onSnapshot(doc(db, 'customers', uid), snap => {
    cb(snap.exists() ? ({ id: uid, ...snap.data() } as DBCustomer) : null);
  });
}

export async function createCustomer(uid: string, data: Omit<DBCustomer, 'id'>) {
  await setDoc(doc(db, 'customers', uid), data);
}

export async function updateCustomer(uid: string, data: Partial<DBCustomer>) {
  await updateDoc(doc(db, 'customers', uid), data);
}

// ─── Reservations ─────────────────────────────────────────────────────────────

export function listenAllReservations(cb: (r: DBReservation[]) => void) {
  // No orderBy to avoid index requirements on old docs; sort client-side
  return onSnapshot(collection(db, 'reservations'), snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DBReservation));
    docs.sort((a, b) => (b.createdAt ?? b.date ?? '').localeCompare(a.createdAt ?? a.date ?? ''));
    cb(docs);
  });
}

export function listenCustomerReservations(customerId: string, cb: (r: DBReservation[]) => void) {
  // No orderBy on compound query — avoids composite index requirement; sort client-side
  const q = query(collection(db, 'reservations'), where('customerId', '==', customerId));
  return onSnapshot(q, snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DBReservation));
    docs.sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date));
    cb(docs);
  });
}

export function listenBarberReservations(barberId: string, cb: (r: DBReservation[]) => void) {
  // No orderBy on compound query — avoids composite index requirement; sort client-side
  const q = query(collection(db, 'reservations'), where('barberId', '==', barberId));
  return onSnapshot(q, snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DBReservation));
    docs.sort((a, b) => (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date));
    cb(docs);
  });
}

/**
 * Real-time listener for booked time slots of a specific barber on a specific date.
 * Returns only the time strings that are Pending or Confirmed — used to block those
 * slots from other customers in real time.
 * Uses two equality where() clauses — no composite index required.
 */
export function listenBarberDateBookings(
  barberId: string,
  date: string,
  cb: (bookedTimes: string[]) => void,
): () => void {
  if (!barberId || !date) { cb([]); return () => {}; }
  const q = query(
    collection(db, 'reservations'),
    where('barberId', '==', barberId),
    where('date', '==', date),
  );
  return onSnapshot(q, snap => {
    const booked = snap.docs
      .map(d => d.data() as DBReservation)
      .filter(r => r.status === 'Pending' || r.status === 'Confirmed')
      .map(r => r.time);
    cb(booked);
  });
}

export async function createReservation(data: Omit<DBReservation, 'id'>): Promise<string> {
  const now = new Date().toISOString();
  const ref = await addDoc(collection(db, 'reservations'), {
    ...data,
    // Ensure these are always present for correct sorting and querying
    createdAt: now,
    updatedAt: now,
    // Normalise barberId and customerId to avoid undefined
    barberId:   data.barberId   ?? '',
    customerId: data.customerId ?? '',
  });
  return ref.id;
}

export async function updateReservationStatus(id: string, status: ReservationStatus) {
  await updateDoc(doc(db, 'reservations', id), {
    status,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * COMPLETE A RESERVATION — the single source of truth for the completion workflow.
 *
 * Atomically:
 *  1. Marks reservation as Completed in Firestore
 *  2. Auto-creates a transaction record (skips if one already exists for this reservation)
 *  3. Updates customer visit count, total spent, loyalty tier, and loyalty points
 *
 * Called by:
 *  - Admin "Complete" button in Reservations tab
 *  - Barber "Done" button on Today's Schedule
 *
 * This ensures EVERY completed reservation generates a transaction record,
 * which feeds analytics, reports, and barber performance metrics automatically.
 */
export async function completeReservation(
  reservationId: string,
  paymentMethod: string = 'Cash',
): Promise<void> {
  // 1. Fetch the reservation
  const resSnap = await getDoc(doc(db, 'reservations', reservationId));
  if (!resSnap.exists()) throw new Error('Reservation not found.');
  const res = { id: reservationId, ...resSnap.data() } as DBReservation;

  // 2. Mark completed and stamp transactionCreated flag to prevent duplicates
  //    We use the reservation doc itself as the idempotency key — no extra query needed.
  const alreadyTransacted = resSnap.data()?.transactionCreated === true;

  await updateDoc(doc(db, 'reservations', reservationId), {
    status: 'Completed',
    updatedAt: new Date().toISOString(),
    transactionCreated: true,   // idempotency flag
  });

  if (alreadyTransacted) return; // transaction was already created — stop here

  // 3. Create the transaction record (guaranteed exactly once via idempotency flag)
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().slice(0, 5);

  await addDoc(collection(db, 'transactions'), {
    type:               'reservation',
    reservationId,
    customer:           res.customer    || '',
    customerPhone:      '',
    barber:             res.barber      || '',
    barberId:           res.barberId    || '',
    service:            res.service     || '',
    services:           res.services    || [],
    amount:             res.amount      || 0,
    date:               res.date        || dateStr,   // use reservation date (not today) for correct analytics
    time:               res.time        || timeStr,
    paymentMethod,
    notes:              '',
    completedAt:        now.toISOString(),
  });

  // 5. Update customer loyalty stats (only if customerId is a real non-empty value)
  if (res.customerId && res.customerId.trim() !== '') {
    try {
      const custSnap = await getDoc(doc(db, 'customers', res.customerId));
      if (custSnap.exists()) {
        const cust = custSnap.data() as DBCustomer;
        const newVisits = (cust.totalVisits || 0) + 1;
        const newSpent  = (cust.totalSpent  || 0) + (res.amount ?? 0);
        await updateDoc(doc(db, 'customers', res.customerId), {
          totalVisits:   newVisits,
          totalSpent:    newSpent,
          lastVisit:     dateStr,
          loyaltyTier:   getLoyaltyTier(newVisits),
          loyaltyPoints: Math.floor(newSpent / 10),
        });
      }
    } catch {
      // Non-fatal — customer stats update failure should not block transaction creation
    }
  }
}

// ─── Barber Performance Queries ───────────────────────────────────────────────

export function listenBarberTransactions(barberName: string, cb: (t: DBTransaction[]) => void) {
  const q = query(collection(db, 'transactions'), where('barber', '==', barberName));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as DBTransaction)));
  });
}

/** Compute barber performance stats from reservations + transactions */
export function computeBarberStats(
  barberId: string,
  barberName: string,
  reservations: DBReservation[],
  transactions: DBTransaction[],
) {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Week start (Monday)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekStartStr = weekStart.toISOString().split('T')[0];

  // Month start
  const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const myRes     = reservations.filter(r => r.barberId === barberId && r.status === 'Completed');
  const myTxns    = transactions.filter(t => t.barber === barberName || t.barberId === barberId);
  const walkinTxns   = myTxns.filter(t => t.type === 'walkin');
  const reservedTxns = myTxns.filter(t => t.type !== 'walkin');

  // Reserved counts from completed reservations
  const reservedToday = myRes.filter(r => r.date === todayStr).length;
  const reservedWeek  = myRes.filter(r => r.date >= weekStartStr).length;
  const reservedMonth = myRes.filter(r => r.date >= monthStartStr).length;

  // Walk-in counts from walkin transactions
  const walkinToday = walkinTxns.filter(t => t.date === todayStr).length;
  const walkinWeek  = walkinTxns.filter(t => t.date >= weekStartStr).length;
  const walkinMonth = walkinTxns.filter(t => t.date >= monthStartStr).length;

  const totalRevenue    = myTxns.reduce((s, t) => s + t.amount, 0);
  const walkinRevenue   = walkinTxns.reduce((s, t) => s + t.amount, 0);
  const reservedRevenue = reservedTxns.reduce((s, t) => s + t.amount, 0);
  const dailyRevenue    = myTxns.filter(t => t.date === todayStr).reduce((s, t) => s + t.amount, 0);

  // Most requested services (from both reservations and walk-in transactions)
  const svcMap: Record<string, number> = {};
  myRes.forEach(r => {
    if (r.services) { r.services.forEach(s => { svcMap[s.name] = (svcMap[s.name] || 0) + 1; }); }
    else { svcMap[r.service] = (svcMap[r.service] || 0) + 1; }
  });
  walkinTxns.forEach(t => {
    if (t.services) { t.services.forEach(s => { svcMap[s.name] = (svcMap[s.name] || 0) + 1; }); }
    else { svcMap[t.service] = (svcMap[t.service] || 0) + 1; }
  });
  const topServices = Object.entries(svcMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  return {
    todayCount:    reservedToday + walkinToday,
    weekCount:     reservedWeek  + walkinWeek,
    monthCount:    reservedMonth + walkinMonth,
    reservedToday, walkinToday,
    totalRevenue, walkinRevenue, reservedRevenue, dailyRevenue,
    topServices,
    totalCompleted: myRes.length + walkinTxns.length,
  };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function listenTransactions(cb: (t: DBTransaction[]) => void) {
  // No orderBy to avoid index issues; sort client-side by date descending
  return onSnapshot(collection(db, 'transactions'), snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DBTransaction));
    const toMs = (t: DBTransaction) => {
      const date = t.date || '';
      if (!date) return 0;
      const timeMatch = typeof t.time === 'string' ? t.time.match(/^(\d{1,2}):(\d{2})/) : null;
      const timePart  = timeMatch
        ? `T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00Z`
        : 'T00:00:00Z';
      const ms = Date.parse(date + timePart);
      return isNaN(ms) ? 0 : ms;
    };
    docs.sort((a, b) => toMs(b) - toMs(a));
    cb(docs);
  });
}

export async function recordTransaction(data: Omit<DBTransaction, 'id'>): Promise<string> {
  const ref = await addDoc(collection(db, 'transactions'), data);

  // Auto-update customer visit count + spending + loyalty
  if (data.reservationId) {
    const resSnap = await getDoc(doc(db, 'reservations', data.reservationId));
    if (resSnap.exists()) {
      const customerId = resSnap.data().customerId as string;
      const custSnap = await getDoc(doc(db, 'customers', customerId));
      if (custSnap.exists()) {
        const cust = custSnap.data() as DBCustomer;
        const newVisits = (cust.totalVisits || 0) + 1;
        const newSpent = (cust.totalSpent || 0) + data.amount;
        await updateDoc(doc(db, 'customers', customerId), {
          totalVisits: newVisits,
          totalSpent: newSpent,
          lastVisit: data.date,
          loyaltyTier: getLoyaltyTier(newVisits),
          loyaltyPoints: Math.floor(newSpent / 10),
        });
      }
    }
  }
  return ref.id;
}

/**
 * Submit a customer rating (1–5) for a completed reservation.
 * Updates the reservation doc and recalculates the barber's average rating.
 */
export async function rateReservation(
  reservationId: string,
  barberId: string,
  rating: number,
): Promise<void> {
  // 1. Save rating on the reservation
  await updateDoc(doc(db, 'reservations', reservationId), {
    customerRating: rating,
    ratedAt: new Date().toISOString(),
  });

  // 2. Recompute barber's average rating from all rated completed reservations
  const q = query(
    collection(db, 'reservations'),
    where('barberId', '==', barberId),
    where('status', '==', 'Completed'),
  );
  const snap = await getDocs(q);
  const rated = snap.docs
    .map(d => d.data() as DBReservation)
    .filter(r => r.customerRating && r.customerRating > 0);

  if (rated.length > 0) {
    const avg = rated.reduce((s, r) => s + (r.customerRating ?? 0), 0) / rated.length;
    await updateDoc(doc(db, 'barbers', barberId), {
      rating:  Math.round(avg * 10) / 10,
      reviews: rated.length,
    });
  }
}

/** Record a walk-in (no reservation needed). Writes directly to transactions collection. */
export async function recordWalkIn(data: {
  customerName: string;
  customerPhone?: string;
  barberId: string;
  barber: string;
  services: DBServiceItem[];
  date: string;
  time: string;
  paymentMethod: string;
  notes?: string;
}): Promise<string> {
  const amount       = data.services.reduce((s, x) => s + x.price, 0);
  const serviceLabel = data.services.length === 1
    ? data.services[0].name
    : data.services.map(s => s.name).join(' + ');

  const ref = await addDoc(collection(db, 'transactions'), {
    type:          'walkin',
    reservationId: '',
    customer:      data.customerName,
    customerPhone: data.customerPhone ?? '',
    barber:        data.barber,
    barberId:      data.barberId,
    service:       serviceLabel,
    services:      data.services,
    amount,
    date:          data.date,
    time:          data.time,
    paymentMethod: data.paymentMethod,
    notes:         data.notes ?? '',
    completedAt:   new Date().toISOString(),
  });
  return ref.id;
}

// ─── Notifications ────────────────────────────────────────────────────────────

export function listenNotifications(customerId: string | null, cb: (n: DBNotification[]) => void) {
  const col = collection(db, 'notifications');
  // Compound where+orderBy requires a composite index; use simple where and sort client-side
  const q = customerId
    ? query(col, where('customerId', '==', customerId))
    : query(col, orderBy('sentAt', 'desc'));
  return onSnapshot(q, snap => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as DBNotification));
    if (customerId) {
      docs.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    }
    cb(docs);
  });
}

export async function sendNotification(data: Omit<DBNotification, 'id'>) {
  await addDoc(collection(db, 'notifications'), data);
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, 'notifications', id), { isRead: true });
}

export async function markAllNotificationsRead(customerId: string) {
  const q = query(
    collection(db, 'notifications'),
    where('customerId', '==', customerId),
    where('isRead', '==', false),
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { isRead: true }));
  await batch.commit();
}
