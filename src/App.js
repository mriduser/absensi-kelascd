import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, where, onSnapshot, doc, deleteDoc, writeBatch, serverTimestamp, Timestamp, updateDoc, setLogLevel } from 'firebase/firestore';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Upload, Calendar as CalendarIcon, UserPlus, Trash2, BookOpen, BarChart2, Users, FileText, UserCheck, Search, Pencil } from 'lucide-react';

// --- Konfigurasi dan Inisialisasi Firebase ---
// Menggunakan environment variables dari file .env
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};
const appId = process.env.REACT_APP_FIREBASE_PROJECT_ID || 'absensi-kelas-default';

// Inisialisasi Firebase hanya sekali
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Aktifkan logging untuk debugging jika diperlukan
// setLogLevel('debug');

// --- Komponen UI ---
const Card = ({ children, className = '' }) => <div className={`bg-white rounded-xl shadow-md p-4 sm:p-6 ${className}`}>{children}</div>;
const Button = ({ children, onClick, variant = 'primary', className = '', ...props }) => {
    const baseClasses = 'px-4 py-2 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed';
    const variants = { primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500', secondary: 'bg-slate-200 text-slate-800 hover:bg-slate-300 focus:ring-slate-400', danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500' };
    return <button onClick={onClick} className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};
const Input = React.forwardRef((props, ref) => <input {...props} ref={ref} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />);
const Select = ({ children, ...props }) => <select {...props} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">{children}</select>;
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-slate-800">{title}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-3xl leading-none font-light">&times;</button>
                </div>
                {children}
            </div>
        </div>
    );
};
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            <p className="text-slate-600 mb-6">{message}</p>
            <div className="flex justify-end gap-3">
                <Button onClick={onClose} variant="secondary">Batal</Button>
                <Button onClick={onConfirm} variant="danger">Ya, Hapus</Button>
            </div>
        </Modal>
    );
};

// --- Halaman Utama Aplikasi ---
export default function App() {
    const [currentPage, setCurrentPage] = useState('attendance');
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                setIsAuthReady(true);
            } else {
                try {
                    // Coba login dengan custom token jika tersedia
                    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
                        await signInWithCustomToken(auth, __initial_auth_token);
                    } else {
                        // Fallback ke login anonim jika tidak ada token
                        await signInAnonymously(auth);
                    }
                    // onAuthStateChanged akan terpanggil lagi setelah login berhasil
                } catch (error) {
                    console.error("Authentication error:", error);
                    setIsAuthReady(true); // Tetap lanjutkan aplikasi meskipun auth gagal
                }
            }
        });
        return () => unsubscribe();
    }, []);

    if (!isAuthReady) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100">
                <div className="flex flex-col items-center gap-4">
                    <BookOpen className="text-indigo-600 animate-pulse" size={48} />
                    <p className="text-lg text-slate-700">Mempersiapkan aplikasi absensi...</p>
                </div>
            </div>
        );
    }

    const NavItem = ({ page, label, icon }) => (
        <button onClick={() => setCurrentPage(page)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${ currentPage === page ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-200' }`}>
            {icon}{label}
        </button>
    );

    return (
        <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="container mx-auto px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <BookOpen className="text-indigo-600" size={28} />
                        <h1 className="text-xl md:text-2xl font-bold text-slate-800">Absensi Kelas</h1>
                    </div>
                    <nav className="flex items-center gap-1 sm:gap-2">
                        <NavItem page="attendance" label="Absensi" icon={<CalendarIcon size={16} />} />
                        <NavItem page="reports" label="Laporan" icon={<BarChart2 size={16} />} />
                        <NavItem page="manage" label="Kelola" icon={<Users size={16} />} />
                    </nav>
                </div>
            </header>
            <main className="container mx-auto p-4 md:p-6">
                {userId ? (
                    <>
                        {currentPage === 'attendance' && <AttendancePage userId={userId} />}
                        {currentPage === 'reports' && <ReportsPage userId={userId} />}
                        {currentPage === 'manage' && <ManageDataPage userId={userId} />}
                    </>
                ) : (
                    <Card>
                        <p className="text-center text-red-500">Gagal melakukan otentikasi. Harap segarkan halaman.</p>
                    </Card>
                )}
            </main>
            <footer className="text-center py-4 text-slate-500 text-sm">
                <p>Dibuat untuk memudahkan pendataan absensi</p>
                <p className="mt-1 text-xs break-all px-4">User ID: {userId || 'Tidak tersedia'}</p>
            </footer>
        </div>
    );
}


// --- Fungsi Helper untuk path koleksi ---
const privateCollection = (userId, name) => collection(db, 'artifacts', appId, 'users', userId, name);

// --- Komponen Kelola Data ---
function ManageDataPage({ userId }) {
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newClassName, setNewClassName] = useState('');
    const [newStudentName, setNewStudentName] = useState('');
    const [selectedClassForStudent, setSelectedClassForStudent] = useState('');
    const [classSearchTerm, setClassSearchTerm] = useState('');
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [studentListText, setStudentListText] = useState('');
    const [selectedClassForUpload, setSelectedClassForUpload] = useState('');
    const [uploadMessage, setUploadMessage] = useState({ text: '', type: 'info' });
    const [isUploading, setIsUploading] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, title: '', message: '' });

    const classCollectionRef = useMemo(() => privateCollection(userId, 'classes'), [userId]);
    const studentCollectionRef = useMemo(() => privateCollection(userId, 'students'), [userId]);

    useEffect(() => {
        const q = query(classCollectionRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const classesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setClasses(classesData);
            if (classesData.length > 0) {
                if (!selectedClassForStudent) setSelectedClassForStudent(classesData[0].id);
                if (!selectedClassForUpload) setSelectedClassForUpload(classesData[0].id);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching classes:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [userId, classCollectionRef]);

    useEffect(() => {
        const q = query(studentCollectionRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setStudents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }, (error) => console.error("Error fetching students:", error));
        return () => unsubscribe();
    }, [userId, studentCollectionRef]);

    const handleAddClass = async (e) => {
        e.preventDefault();
        if (newClassName.trim() === '') return;
        await addDoc(classCollectionRef, { name: newClassName.trim(), createdAt: serverTimestamp() });
        setNewClassName('');
    };

    const handleAddStudent = async (e) => {
        e.preventDefault();
        if (newStudentName.trim() === '' || !selectedClassForStudent) return;
        await addDoc(studentCollectionRef, { name: newStudentName.trim(), classId: selectedClassForStudent, createdAt: serverTimestamp() });
        setNewStudentName('');
    };

    const openEditModal = (item, type) => {
        setEditingItem({ ...item, type });
        setEditingValue(item.name);
        setIsEditModalOpen(true);
    };

    const handleUpdateItem = async (e) => {
        e.preventDefault();
        if (!editingItem || editingValue.trim() === '') return;
        const collectionName = editingItem.type === 'class' ? 'classes' : 'students';
        const itemRef = doc(db, 'artifacts', appId, 'users', userId, collectionName, editingItem.id);
        await updateDoc(itemRef, { name: editingValue.trim() });
        setIsEditModalOpen(false);
        setEditingItem(null);
    };

    const handleDeleteClick = (item, type) => {
        const message = type === 'class' ? `Anda yakin ingin menghapus kelas "${item.name}"? Semua data siswa dan absensi di dalam kelas ini juga akan terhapus secara permanen.` : `Anda yakin ingin menghapus siswa "${item.name}"? Semua data absensinya juga akan terhapus.`;
        setConfirmModal({
            isOpen: true,
            title: `Konfirmasi Hapus`,
            message: message,
            onConfirm: () => handleConfirmDelete(item, type)
        });
    };

    const handleConfirmDelete = async (item, type) => {
        try {
            const collectionName = type === 'class' ? 'classes' : 'students';
            await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, collectionName, item.id));

            const batch = writeBatch(db);
            const attendanceCollectionRef = privateCollection(userId, 'attendance');

            if (type === 'class') {
                const studentQuery = query(studentCollectionRef, where("classId", "==", item.id));
                const studentDocs = await getDocs(studentQuery);
                studentDocs.forEach(studentDoc => batch.delete(studentDoc.ref));

                const attendanceQuery = query(attendanceCollectionRef, where("classId", "==", item.id));
                const attendanceDocs = await getDocs(attendanceQuery);
                attendanceDocs.forEach(attDoc => batch.delete(attDoc.ref));
            } else { // type === 'student'
                const attendanceQuery = query(attendanceCollectionRef, where("studentId", "==", item.id));
                const attendanceDocs = await getDocs(attendanceQuery);
                attendanceDocs.forEach(attDoc => batch.delete(attDoc.ref));
            }
            await batch.commit();
        } catch (e) {
            console.error("Gagal menghapus:", e);
        } finally {
            setConfirmModal({ isOpen: false, onConfirm: null, title: '', message: '' });
        }
    };
    
    const handleBulkUploadStudents = async (e) => {
        e.preventDefault();
        if (studentListText.trim() === '' || !selectedClassForUpload) {
            setUploadMessage({ text: "Pastikan daftar nama siswa tidak kosong dan kelas sudah dipilih.", type: 'error' });
            return;
        }
        setIsUploading(true);
        setUploadMessage({ text: 'Mengunggah...', type: 'info' });
        const studentNames = studentListText.split('\n').map(name => name.trim()).filter(name => name !== '');
        if (studentNames.length === 0) {
            setUploadMessage({ text: "Tidak ada nama siswa yang valid untuk diunggah.", type: 'error' });
            setIsUploading(false);
            return;
        }
        const batch = writeBatch(db);
        studentNames.forEach(name => {
            const studentRef = doc(studentCollectionRef);
            batch.set(studentRef, { name, classId: selectedClassForUpload, createdAt: serverTimestamp() });
        });
        try {
            await batch.commit();
            setUploadMessage({ text: `${studentNames.length} siswa berhasil ditambahkan!`, type: 'success' });
            setStudentListText('');
            setTimeout(() => {
                setIsUploadModalOpen(false);
                setUploadMessage({ text: '', type: 'info' });
            }, 2000);
        } catch (error) {
            console.error("Gagal mengunggah siswa: ", error);
            setUploadMessage({ text: "Terjadi kesalahan saat mengunggah. Coba lagi.", type: 'error' });
        } finally {
            setIsUploading(false);
        }
    };

    const filteredClasses = useMemo(() => classes.filter(c => c.name.toLowerCase().includes(classSearchTerm.toLowerCase())), [classes, classSearchTerm]);
    const filteredStudents = useMemo(() => students.filter(s => s.name.toLowerCase().includes(studentSearchTerm.toLowerCase())), [students, studentSearchTerm]);

    return (
        <>
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Kelola Kelas</h2>
                    <form onSubmit={handleAddClass} className="flex gap-2 mb-4">
                        <Input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="Nama Kelas Baru" required />
                        <Button type="submit">Tambah</Button>
                    </form>
                    <div className="relative mb-2">
                        <Input type="text" placeholder="Cari kelas..." value={classSearchTerm} onChange={e => setClassSearchTerm(e.target.value)} />
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">{isLoading ? <p>Memuat...</p> : filteredClasses.length > 0 ? filteredClasses.map(c => (
                        <div key={c.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg hover:bg-slate-100">
                            <span className="text-slate-700">{c.name}</span>
                            <div className="flex gap-2">
                                <button onClick={() => openEditModal(c, 'class')} className="text-blue-500 hover:text-blue-700"><Pencil size={16} /></button>
                                <button onClick={() => handleDeleteClick(c, 'class')} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                            </div>
                        </div>)) : <p className="text-sm text-slate-500 text-center py-4">Belum ada kelas.</p>}
                    </div>
                </Card>
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-slate-800">Kelola Siswa</h2>
                        <Button onClick={() => setIsUploadModalOpen(true)} variant="secondary" className="text-sm py-1 px-3" disabled={classes.length === 0}>
                            <Upload size={14} /> Upload
                        </Button>
                    </div>
                    <form onSubmit={handleAddStudent} className="space-y-3">
                        <Input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="Nama Siswa Baru" required />
                        <Select value={selectedClassForStudent} onChange={e => setSelectedClassForStudent(e.target.value)} required disabled={classes.length === 0}>
                            <option value="" disabled>Pilih Kelas</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </Select>
                        <Button type="submit" className="w-full" disabled={classes.length === 0}>
                            <UserPlus size={16} /> Tambah Siswa
                        </Button>
                    </form>
                </Card>
                <div className="md:col-span-2">
                    <Card>
                        <h2 className="text-xl font-bold text-slate-800 mb-4">Daftar Semua Siswa</h2>
                        <div className="relative mb-2">
                            <Input type="text" placeholder="Cari siswa..." value={studentSearchTerm} onChange={e => setStudentSearchTerm(e.target.value)} />
                            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                            {filteredStudents.length > 0 ? filteredStudents.map(s => {
                                const studentClass = classes.find(c => c.id === s.classId);
                                return (
                                    <div key={s.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg hover:bg-slate-100">
                                        <div>
                                            <p className="font-semibold text-slate-800">{s.name}</p>
                                            <p className="text-sm text-slate-500">{studentClass ? studentClass.name : 'Kelas tidak diketahui'}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => openEditModal(s, 'student')} className="text-blue-500 hover:text-blue-700"><Pencil size={16} /></button>
                                            <button onClick={() => handleDeleteClick(s, 'student')} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                );
                            }) : <p className="text-sm text-slate-500 text-center py-4">Belum ada siswa.</p>}
                        </div>
                    </Card>
                </div>
            </div>
            <Modal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} title="Upload Daftar Siswa">
                <form onSubmit={handleBulkUploadStudents} className="space-y-4">
                    <Select value={selectedClassForUpload} onChange={e => setSelectedClassForUpload(e.target.value)} required>
                        <option value="" disabled>Pilih Kelas Tujuan</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                    <textarea value={studentListText} onChange={e => setStudentListText(e.target.value)} rows="10" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Satu nama per baris, contoh:&#x0a;Budi Doremi&#x0a;Siti Nurbaya&#x0a;Joko Anwar" required />
                    <Button type="submit" className="w-full" disabled={isUploading}>{isUploading ? 'Mengunggah...' : 'Unggah Daftar Siswa'}</Button>
                    {uploadMessage.text && <p className={`text-center text-sm mt-2 font-medium ${uploadMessage.type === 'success' ? 'text-green-600' : uploadMessage.type === 'error' ? 'text-red-600' : 'text-indigo-600'}`}>{uploadMessage.text}</p>}
                </form>
            </Modal>
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Nama ${editingItem?.type === 'class' ? 'Kelas' : 'Siswa'}`}>
                <form onSubmit={handleUpdateItem} className="space-y-4">
                    <Input type="text" value={editingValue} onChange={e => setEditingValue(e.target.value)} required autoFocus />
                    <Button type="submit" className="w-full">Simpan Perubahan</Button>
                </form>
            </Modal>
            <ConfirmationModal isOpen={confirmModal.isOpen} onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={confirmModal.onConfirm} title={confirmModal.title} message={confirmModal.message} />
        </>
    );
}

// --- Komponen Absensi Harian ---
function AttendancePage({ userId }) {
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [students, setStudents] = useState([]);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendance, setAttendance] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [message, setMessage] = useState('');
    const messageTimeoutRef = useRef(null);

    const classCollectionRef = useMemo(() => privateCollection(userId, 'classes'), [userId]);

    useEffect(() => {
        const q = query(classCollectionRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const classesData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setClasses(classesData);
            if (classesData.length > 0 && !selectedClass) {
                setSelectedClass(classesData[0].id);
            } else if (classesData.length === 0) {
                setIsLoading(false);
            }
        }, error => {
            console.error("Error fetching classes for attendance:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [userId, classCollectionRef]);

    useEffect(() => {
        if (!selectedClass || !userId || !date) {
            setStudents([]);
            setAttendance({});
            setIsLoading(classes.length > 0);
            return;
        }

        setIsLoading(true);
        const studentsQuery = query(privateCollection(userId, 'students'), where('classId', '==', selectedClass));
        const unsubscribeStudents = onSnapshot(studentsQuery, async (studentSnapshot) => {
            const studentList = studentSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setStudents(studentList);

            const attendanceQuery = query(privateCollection(userId, 'attendance'), where('classId', '==', selectedClass));
            const attendanceSnapshot = await getDocs(attendanceQuery);
            
            const selectedDateStr = new Date(date).toDateString();
            const savedAttendanceForDate = {};
            attendanceSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.date && data.date.toDate().toDateString() === selectedDateStr) {
                    savedAttendanceForDate[data.studentId] = { status: data.status, note: data.note || '' };
                }
            });

            const initialAttendance = {};
            studentList.forEach(student => {
                initialAttendance[student.id] = savedAttendanceForDate[student.id] || { status: 'Hadir', note: '' };
            });

            setAttendance(initialAttendance);
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching students:", error);
            setIsLoading(false);
        });

        return () => unsubscribeStudents();
    }, [selectedClass, userId, date, classes.length]);

    const handleStatusChange = (studentId, status) => {
        setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], status } }));
    };

    const handleNoteChange = (studentId, note) => {
        setAttendance(prev => ({ ...prev, [studentId]: { ...prev[studentId], note } }));
    };
    
    const showMessage = (text, duration = 3000) => {
        setMessage(text);
        if (messageTimeoutRef.current) {
            clearTimeout(messageTimeoutRef.current);
        }
        messageTimeoutRef.current = setTimeout(() => setMessage(''), duration);
    };

    const saveAttendance = async () => {
        if (students.length === 0) {
            showMessage('Tidak ada siswa di kelas ini untuk diabsen.');
            return;
        }
        setIsLoading(true);
        setMessage('');

        try {
            const attendanceDate = new Date(date);
            // Untuk menghindari masalah timezone, set jam ke tengah hari
            attendanceDate.setHours(12, 0, 0, 0);

            const attendanceCollectionRef = privateCollection(userId, 'attendance');
            const allAttendanceForClassQuery = query(attendanceCollectionRef, where('classId', '==', selectedClass));
            const allAttendanceForClassSnapshot = await getDocs(allAttendanceForClassQuery);

            const deleteBatch = writeBatch(db);
            const selectedDateStr = attendanceDate.toDateString();
            allAttendanceForClassSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.date && data.date.toDate().toDateString() === selectedDateStr) {
                    deleteBatch.delete(doc.ref);
                }
            });
            await deleteBatch.commit();

            const saveBatch = writeBatch(db);
            Object.entries(attendance).forEach(([studentId, data]) => {
                if (students.some(s => s.id === studentId)) {
                    const attendanceRef = doc(attendanceCollectionRef);
                    saveBatch.set(attendanceRef, {
                        studentId,
                        classId: selectedClass,
                        date: Timestamp.fromDate(attendanceDate),
                        status: data.status,
                        note: data.note || '',
                        createdAt: serverTimestamp()
                    });
                }
            });
            await saveBatch.commit();
            showMessage('Absensi berhasil disimpan!');
        } catch (error) {
            console.error("Error saving attendance: ", error);
            showMessage('Gagal menyimpan absensi. Coba lagi.');
        } finally {
            setIsLoading(false);
        }
    };

    const STATUS_OPTIONS = ['Hadir', 'Sakit', 'Izin', 'Alpa'];
    const STATUS_COLORS = { Hadir: 'bg-green-500 hover:bg-green-600', Sakit: 'bg-yellow-500 hover:bg-yellow-600', Izin: 'bg-blue-500 hover:bg-blue-600', Alpa: 'bg-red-500 hover:bg-red-600' };
    const ACTIVE_STATUS_COLORS = { Hadir: 'bg-green-600 ring-2 ring-offset-2 ring-green-500', Sakit: 'bg-yellow-600 ring-2 ring-offset-2 ring-yellow-500', Izin: 'bg-blue-600 ring-2 ring-offset-2 ring-blue-500', Alpa: 'bg-red-600 ring-2 ring-offset-2 ring-red-500' };

    return (
        <Card>
            <div className="flex flex-wrap gap-4 items-center mb-6">
                <div className="flex-grow min-w-[150px]">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Pilih Kelas</label>
                    <Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={classes.length === 0}>
                        <option value="" disabled>Pilih Kelas...</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                </div>
                <div className="flex-grow min-w-[150px]">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Tanggal</label>
                    <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </div>
            </div>

            {isLoading && <p className="text-center p-4 text-slate-500">Memuat daftar siswa...</p>}
            
            {!isLoading && students.length > 0 && (
                <div className="space-y-3">
                    {students.map(student => (
                        <div key={student.id} className="p-4 bg-slate-50 rounded-lg flex flex-col gap-3 transition-all">
                            <div className="flex flex-col md:flex-row justify-between items-center w-full">
                                <p className="font-semibold text-slate-800 mb-3 md:mb-0">{student.name}</p>
                                <div className="flex gap-2 flex-wrap justify-center">
                                    {STATUS_OPTIONS.map(status => (
                                        <button key={status} onClick={() => handleStatusChange(student.id, status)} className={`px-3 py-1 text-sm text-white rounded-full transition-all focus:outline-none ${ attendance[student.id]?.status === status ? ACTIVE_STATUS_COLORS[status] : STATUS_COLORS[status] }`}>
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {(attendance[student.id]?.status === 'Sakit' || attendance[student.id]?.status === 'Izin') && (
                                <Input type="text" placeholder="Tambahkan catatan (opsional)..." value={attendance[student.id]?.note || ''} onChange={(e) => handleNoteChange(student.id, e.target.value)} className="mt-2" />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {!isLoading && students.length > 0 && (
                <div className="mt-6 text-center">
                    <Button onClick={saveAttendance} disabled={isLoading}>{isLoading ? 'Menyimpan...' : 'Simpan Absensi'}</Button>
                    {message && <p className="mt-4 text-sm font-semibold text-indigo-600">{message}</p>}
                </div>
            )}

            {!isLoading && classes.length === 0 && <p className="text-slate-500 text-center py-8">Anda belum membuat kelas. Silakan ke halaman 'Kelola' untuk menambahkan kelas terlebih dahulu.</p>}
            
            {!isLoading && students.length === 0 && selectedClass && <p className="text-slate-500 text-center py-8">Tidak ada siswa di kelas ini. Silakan ke halaman 'Kelola' untuk menambahkan siswa.</p>}
        </Card>
    );
}

// --- Komponen Laporan ---
function ReportsPage({ userId }) {
    const [view, setView] = useState('class');
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedStudent, setSelectedStudent] = useState('');
    const [allAttendance, setAllAttendance] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [reportStartDate, setReportStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [reportEndDate, setReportEndDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0));
    const [year, setYear] = useState(new Date().getFullYear());

    const classCollectionRef = useMemo(() => privateCollection(userId, 'classes'), [userId]);

    useEffect(() => {
        const q = query(classCollectionRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const d = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setClasses(d);
            if (d.length > 0 && !selectedClass) {
                setSelectedClass(d[0].id);
            } else if (d.length === 0) {
                setIsLoading(false);
            }
        }, error => {
            console.error("Error fetching classes for reports:", error);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [userId, classCollectionRef]);

    useEffect(() => {
        if (!selectedClass || !userId) {
            setStudents([]);
            setAllAttendance([]);
            setIsLoading(classes.length > 0);
            return;
        }

        setIsLoading(true);
        const studentQuery = query(privateCollection(userId, 'students'), where('classId', '==', selectedClass));
        const attendanceQuery = query(privateCollection(userId, 'attendance'), where('classId', '==', selectedClass));

        const unsubStudents = onSnapshot(studentQuery, (sSnapshot) => {
            const studentList = sSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setStudents(studentList);
            if (studentList.length > 0 && !selectedStudent) {
                setSelectedStudent(studentList[0].id);
            }
        });

        const unsubAttendance = onSnapshot(attendanceQuery, (aSnapshot) => {
            setAllAttendance(aSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoading(false);
        });

        return () => {
            unsubStudents();
            unsubAttendance();
        };
    }, [selectedClass, userId, classes.length]);

    const classReportData = useMemo(() => {
        const counts = { 'Hadir': 0, 'Sakit': 0, 'Izin': 0, 'Alpa': 0 };
        const endOfDayEndDate = new Date(reportEndDate);
        endOfDayEndDate.setHours(23, 59, 59, 999); // Set to end of day

        allAttendance.forEach(att => {
            const attDate = att.date.toDate();
            if (attDate >= reportStartDate && attDate <= endOfDayEndDate) {
                if (counts.hasOwnProperty(att.status)) {
                    counts[att.status]++;
                }
            }
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).filter(item => item.value > 0);
    }, [allAttendance, reportStartDate, reportEndDate]);

    const handleMonthChange = (month, year) => {
        setReportStartDate(new Date(year, month, 1));
        setReportEndDate(new Date(year, month + 1, 0));
        setYear(year);
    };

    const setSemester = (semester) => {
        const currentYear = year;
        if (semester === 1) { // Semester Ganjil (Juli - Desember)
            setReportStartDate(new Date(currentYear, 6, 1));
            setReportEndDate(new Date(currentYear, 11, 31));
        } else { // Semester Genap (Januari - Juni)
            setReportStartDate(new Date(currentYear, 0, 1));
            setReportEndDate(new Date(currentYear, 5, 30));
        }
    };

    const studentReportData = useMemo(() => {
        if (!selectedStudent) return { summary: [], details: [] };
        const counts = { 'Hadir': 0, 'Sakit': 0, 'Izin': 0, 'Alpa': 0 };
        const details = allAttendance
            .filter(att => att.studentId === selectedStudent)
            .sort((a, b) => b.date.toDate() - a.date.toDate());
        details.forEach(att => {
            if (counts.hasOwnProperty(att.status)) {
                counts[att.status]++;
            }
        });
        return {
            summary: Object.entries(counts).map(([name, value]) => ({ name, value })),
            details
        };
    }, [allAttendance, selectedStudent]);

    const COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444'];
    const STATUS_BADGE_COLORS = { Hadir: 'bg-green-100 text-green-800', Sakit: 'bg-yellow-100 text-yellow-800', Izin: 'bg-blue-100 text-blue-800', Alpa: 'bg-red-100 text-red-800' };
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    return (
        <Card>
            <div className="flex border-b mb-4">
                <button onClick={() => setView('class')} className={`py-2 px-4 font-semibold flex items-center gap-2 ${view === 'class' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-600'}`}>
                    <FileText size={16} /> Laporan Kelas
                </button>
                <button onClick={() => setView('student')} className={`py-2 px-4 font-semibold flex items-center gap-2 ${view === 'student' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-slate-500 hover:text-slate-600'}`}>
                    <UserCheck size={16} /> Laporan Siswa
                </button>
            </div>

            {view === 'class' && (
                <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Laporan Absensi Kelas</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end mb-6">
                        <div className="w-full"><label className="block text-sm font-medium text-slate-600 mb-1">Kelas</label><Select value={selectedClass} onChange={e => setSelectedClass(e.target.value)} disabled={classes.length === 0}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                        <div className="w-full"><label className="block text-sm font-medium text-slate-600 mb-1">Bulan</label><Select value={reportStartDate.getMonth()} onChange={e => handleMonthChange(parseInt(e.target.value), year)}>{months.map((m, i) => <option key={i} value={i}>{m}</option>)}</Select></div>
                        <div className="w-full"><label className="block text-sm font-medium text-slate-600 mb-1">Tahun</label><Select value={year} onChange={e => handleMonthChange(reportStartDate.getMonth(), parseInt(e.target.value))}>{years.map(y => <option key={y} value={y}>{y}</option>)}</Select></div>
                        <div className="w-full flex gap-2"><Button onClick={() => setSemester(2)} variant="secondary" className="w-full text-xs">Sem. Genap</Button><Button onClick={() => setSemester(1)} variant="secondary" className="w-full text-xs">Sem. Ganjil</Button></div>
                    </div>
                    <div style={{ width: '100%', height: 400 }}>
                        {isLoading ? <p className="text-center pt-16 text-slate-500">Memuat data laporan...</p> : classReportData.length > 0 ? (
                            <ResponsiveContainer>
                                <PieChart>
                                    <Pie data={classReportData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={120} fill="#8884d8" dataKey="value">
                                        {classReportData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={(value) => [`${value} kali`, 'Jumlah']} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <div className="flex items-center justify-center h-full"><p className="text-slate-500">Tidak ada data absensi untuk periode ini.</p></div>}
                    </div>
                </div>
            )}

            {view === 'student' && (
                <div>
                    <h2 className="text-xl font-bold text-slate-800 mb-4">Laporan Absensi Individual Siswa</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end mb-6">
                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Kelas</label><Select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedStudent(''); }} disabled={classes.length === 0}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></div>
                        <div><label className="block text-sm font-medium text-slate-600 mb-1">Siswa</label><Select value={selectedStudent} onChange={e => setSelectedStudent(e.target.value)} disabled={students.length === 0}>{students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></div>
                    </div>
                    {isLoading ? <p className="text-center pt-16 text-slate-500">Memuat data siswa...</p> : selectedStudent ? (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                            <div className="lg:col-span-1">
                                <h3 className="font-bold text-lg mb-2">Ringkasan Total</h3>
                                <div style={{ width: '100%', height: 250 }}>
                                    <ResponsiveContainer>
                                        <BarChart data={studentReportData.summary} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                            <XAxis type="number" allowDecimals={false} />
                                            <YAxis type="category" dataKey="name" width={60} />
                                            <Tooltip />
                                            <Bar dataKey="value" fill="#8884d8" barSize={20}>
                                                {studentReportData.summary.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="lg:col-span-2">
                                <h3 className="font-bold text-lg mb-2">Detail Kehadiran (Semua Waktu)</h3>
                                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                                    {studentReportData.details.length > 0 ? studentReportData.details.map(att => (
                                        <div key={att.id} className="bg-slate-50 p-3 rounded-lg hover:bg-slate-100">
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold text-sm">{att.date.toDate().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGE_COLORS[att.status]}`}>{att.status}</span>
                                            </div>
                                            {att.note && <p className="text-sm text-slate-600 mt-1 pl-2 border-l-2 border-slate-300">Catatan: {att.note}</p>}
                                        </div>
                                    )) : <p className="text-slate-500 text-center py-4">Tidak ada catatan absensi untuk siswa ini.</p>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-center pt-16 text-slate-500">{classes.length > 0 ? 'Pilih kelas dan siswa untuk melihat laporan.' : 'Buat kelas dan tambahkan siswa terlebih dahulu.'}</p>
                    )}
                </div>
            )}
        </Card>
    );
}
