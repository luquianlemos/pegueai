import React, { useState, useEffect, useRef } from 'react';
import { FileText, Upload, Copy, Trash2, ExternalLink, Plus, Zap, MousePointer2, Loader2, Menu, X, Link as LinkIcon, Scissors, Edit2, Search, User, CreditCard, Lock, Calendar, RefreshCw, ChevronUp, BarChart3, Globe, Smartphone, CalendarDays, AlertCircle, AlertTriangle, XCircle, Gift, DollarSign, TrendingUp, Users, Folder, FolderPlus, ArrowLeft, CornerDownRight, FolderInput, CheckCircle } from 'lucide-react';
import { storage, db } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';

// --- COMPONENTES VISUAIS ---

const PurpleGlassCard = ({ children, className = "", onClick }: any) => (
  <div 
    onClick={onClick}
    className={`
      bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl transition-all duration-200 
      ${onClick ? 'cursor-pointer hover:bg-white/10 hover:scale-[1.01] active:scale-95' : 'hover:border-purple-400/30'}
      shadow-xl shadow-purple-900/20 group
      ${className}
    `}
  >
    {children}
  </div>
);

const StatCard = ({ icon: Icon, label, value, colorClass, onClick }: any) => (
  <PurpleGlassCard className="p-6 relative overflow-hidden" onClick={onClick}>
    <div className={`absolute -right-6 -top-6 w-24 h-24 ${colorClass} opacity-20 blur-2xl rounded-full group-hover:opacity-40 transition-opacity`}></div>
    <div className="relative z-10 flex items-start justify-between">
      <div>
        <p className="text-purple-200 text-xs font-bold uppercase tracking-wider mb-2">{label}</p>
        <h3 className="text-3xl font-black text-white">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClass} text-white shadow-lg`}>
        <Icon size={22} strokeWidth={2.5} />
      </div>
    </div>
  </PurpleGlassCard>
);

const Logo = () => (
  <div className="flex items-center gap-3 group cursor-default px-2">
    <img 
      src="https://cdn-icons-png.flaticon.com/512/8662/8662199.png" 
      alt="Poplink Logo" 
      className="h-10 w-auto object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)] transition-transform group-hover:scale-105"
    />
    <h1 className="font-black text-2xl tracking-tight bg-gradient-to-r from-white via-white to-purple-200 bg-clip-text text-transparent filter drop-shadow-[0_2px_2px_rgba(0,0,0,0.3)]">
      poplink
    </h1>
  </div>
);

const TooltipButton = ({ onClick, icon: Icon, label, className }: any) => (
  <div className="group relative inline-block">
    <button onClick={(e) => { e.stopPropagation(); onClick(e); }} className={`relative z-10 ${className}`}>
      <Icon size={18} />
    </button>
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black/90 border border-white/10 text-white text-[10px] font-bold uppercase tracking-wider rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 shadow-xl">
      {label}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-black/90"></div>
    </div>
  </div>
);

// --- APP PRINCIPAL ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [items, setItems] = useState<any[]>([]); 
  const [stats, setStats] = useState({ links: 0, clicks: 0, filesCount: 0 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Drag & Drop (Apenas para Upload do PC)
  const [isDraggingFile, setIsDraggingFile] = useState(false); 

  // Filtros
  const [dateRange, setDateRange] = useState('7d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Modais
  const [showShortenModal, setShowShortenModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false); 
  const [showMoveModal, setShowMoveModal] = useState(false);

  const [attemptedFileSize, setAttemptedFileSize] = useState('');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [movingItem, setMovingItem] = useState<any>(null);
  
  // Formulários
  const [urlToShorten, setUrlToShorten] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editAlias, setEditAlias] = useState(''); 
  const [newFolderName, setNewFolderName] = useState(''); 
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTaskRef = useRef<any>(null);

  const referralData = { code: "admin_vip", link: "poplink.me/convite/admin_vip", earnings: "R$ 450,00", pending: "R$ 120,00", referrals: 15, history: [ { id: 1, user: "Carlos M.", plan: "Plano Gold", date: "Hoje", commission: "R$ 15,00" }, { id: 2, user: "Agência X", plan: "Plano Pro", date: "Ontem", commission: "R$ 29,00" }, { id: 3, user: "Ana B.", plan: "Plano Basic", date: "12/05", commission: "R$ 9,00" } ] };
  const [planDetails] = useState({ name: "Plano Gold", limit: "10 GB", used: "2.5 GB", expires: "25/12/2025" });
  const [currentFolder, setCurrentFolder] = useState<any>(null);
  const [folderPath, setFolderPath] = useState<any[]>([]);

  // Carregar dados
  useEffect(() => {
    try {
      const q = query(collection(db, "uploads"), orderBy("createdAt", "desc")); 
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setItems(data);
        
        const filesOnly = data.filter((item: any) => item.type !== 'link_shortened' && item.type !== 'folder');
        const linksOnly = data.filter((item: any) => item.type === 'link_shortened');
        setStats({
          links: linksOnly.length, 
          clicks: data.reduce((acc: number, curr: any) => acc + (curr.clicks || 0), 0),
          filesCount: filesOnly.length
        });
      });
      return () => unsubscribe();
    } catch (error) { console.log("Erro banco:", error); }
  }, []);

  useEffect(() => { setSearchQuery(''); }, [activeTab]);

  const enterFolder = (folder: any) => { setFolderPath([...folderPath, folder]); setCurrentFolder(folder.id); setSearchQuery(''); };
  const goBack = () => { const newPath = [...folderPath]; newPath.pop(); setFolderPath(newPath); setCurrentFolder(newPath.length > 0 ? newPath[newPath.length - 1].id : null); };
  const goHome = () => { setFolderPath([]); setCurrentFolder(null); };

  // --- ARQUIVOS ---
  const handleCreateFolder = async (e: React.FormEvent) => { e.preventDefault(); if(!newFolderName) return; try { await addDoc(collection(db, "uploads"), { name: newFolderName, type: 'folder', folderId: currentFolder, createdAt: serverTimestamp(), size: '-', clicks: 0, poplink: '-', originalUrl: '-' }); setShowFolderModal(false); setNewFolderName(''); } catch (error) { alert("Erro: " + error); } };
  
  // Função de Mover (Pelo Botão)
  const handleMoveItem = async (targetFolderId: any) => { 
    if (!movingItem) return; 
    try { 
      await updateDoc(doc(db, "uploads", movingItem.id), { folderId: targetFolderId }); 
      setShowMoveModal(false); 
      setMovingItem(null); 
    } catch (error) { alert("Erro ao mover: " + error); } 
  };
  const openMoveModal = (item: any) => { setMovingItem(item); setShowMoveModal(true); };

  const MAX_FILE_SIZE_MB = 130;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
  const checkFileSize = (file: File) => { if (file.size > MAX_FILE_SIZE_BYTES) { setAttemptedFileSize((file.size / 1024 / 1024).toFixed(2)); setShowLimitModal(true); return false; } return true; };
  
  const processFileUpload = async (file: File) => {
    if (!checkFileSize(file)) return; setUploading(true);
    try {
      const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTaskRef.current = uploadTask;
      uploadTask.on('state_changed', (snapshot) => { const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100; setProgress(p); }, (error: any) => { if (error.code !== 'storage/canceled') alert("Erro: " + error.message); setUploading(false); setProgress(0); uploadTaskRef.current = null; }, async () => { 
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref); const shortCode = Math.random().toString(36).substr(2, 6); 
          await addDoc(collection(db, "uploads"), { name: file.name, url: downloadURL, type: file.type, size: (file.size / 1024 / 1024).toFixed(2), clicks: 0, createdAt: serverTimestamp(), poplink: `poplink.me/${shortCode}`, originalUrl: downloadURL, storageRef: storageRef.fullPath, folderId: currentFolder }); 
          setUploading(false); setProgress(0); uploadTaskRef.current = null; setActiveTab('files'); 
      });
    } catch (error) { alert("Erro: " + error); setUploading(false); }
  };

  const handleFileInputChange = (event: any) => { const file = event.target.files[0]; if (!file) return; processFileUpload(file); event.target.value = ''; };
  const cancelUpload = () => { if (uploadTaskRef.current) { uploadTaskRef.current.cancel(); setUploading(false); setProgress(0); } };
  
  // Drag & Drop apenas para UPLOAD DO PC (Global)
  const handleGlobalDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(true); };
  const handleGlobalDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); };
  const handleGlobalDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDraggingFile(false); const file = e.dataTransfer.files[0]; if (file) processFileUpload(file); };

  const handleShortenLink = async (e: React.FormEvent) => { e.preventDefault(); if (!urlToShorten) return; try { const shortCode = customAlias || Math.random().toString(36).substr(2, 6); await addDoc(collection(db, "uploads"), { name: customAlias || `Link Encurtado ${shortCode}`, url: urlToShorten, type: 'link_shortened', size: '0', clicks: 0, createdAt: serverTimestamp(), poplink: `poplink.me/${shortCode}`, originalUrl: urlToShorten, folderId: currentFolder }); setShowShortenModal(false); setUrlToShorten(''); setCustomAlias(''); setActiveTab('links'); } catch (error) { alert("Erro: " + error); } };
  const handleDelete = async (item: any) => { if (confirm(`Tem certeza que deseja excluir "${item.name}"?`)) { try { await deleteDoc(doc(db, "uploads", item.id)); if (item.type !== 'link_shortened' && item.type !== 'folder' && item.storageRef) { await deleteObject(ref(storage, item.storageRef)); } } catch (error) { console.error("Erro:", error); } } };
  const openEditModal = (item: any) => { setEditingItem(item); setEditName(item.name); setEditUrl(item.originalUrl); setEditAlias(item.poplink ? item.poplink.split('/').pop() : ''); setShowEditModal(true); };
  const handleEditSave = async (e: React.FormEvent) => { e.preventDefault(); if (!editingItem) return; const file = fileInputRef.current?.files?.[0]; if (file && !checkFileSize(file)) return; setUploading(true); try { const updates: any = { name: editName, poplink: `poplink.me/${editAlias}` }; if (editingItem.type === 'link_shortened') { updates.url = editUrl; updates.originalUrl = editUrl; } else if (editingItem.type !== 'folder') { if (file) { if (editingItem.storageRef) { try { await deleteObject(ref(storage, editingItem.storageRef)); } catch (err) {} } const storageRef = ref(storage, `uploads/${Date.now()}_${file.name}`); const uploadTask = uploadBytesResumable(storageRef, file); uploadTaskRef.current = uploadTask; await new Promise((resolve, reject) => { uploadTask.on('state_changed', (snapshot) => setProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100), (error: any) => { if (error.code === 'storage/canceled') reject("Cancelado"); else reject(error); }, async () => { const downloadURL = await getDownloadURL(uploadTask.snapshot.ref); updates.url = downloadURL; updates.originalUrl = downloadURL; updates.type = file.type; updates.size = (file.size / 1024 / 1024).toFixed(2); updates.storageRef = storageRef.fullPath; resolve(null); }); }); } } await updateDoc(doc(db, "uploads", editingItem.id), updates); setShowEditModal(false); setEditingItem(null); } catch (error) { if (error !== "Cancelado") alert("Erro: " + error); } finally { setUploading(false); setProgress(0); uploadTaskRef.current = null; } };

  const filteredItems = items.filter(item => {
    if (activeTab === 'files' && item.type === 'link_shortened') return false;
    if (activeTab === 'links' && item.type !== 'link_shortened') return false;
    if (searchQuery) { const query = searchQuery.toLowerCase(); return item.name?.toLowerCase().includes(query) || item.poplink?.toLowerCase().includes(query); }
    if (!item.folderId && currentFolder === null) return true;
    if (item.folderId === currentFolder) return true;
    return false;
  });

  const foldersList = filteredItems.filter(i => i.type === 'folder');
  const filesList = filteredItems.filter(i => i.type !== 'folder');
  const displayItems = (activeTab === 'dashboard' && !searchQuery) ? filteredItems.slice(0, 5) : [...foldersList, ...filesList];
  const menuItems = [{ id: 'dashboard', emoji: '📊', label: 'Dashboard' }, { id: 'links', emoji: '🔗', label: 'Meus Links' }, { id: 'files', emoji: '📁', label: 'Arquivos' }, { id: 'analytics', emoji: '📈', label: 'Analytics' }];

  return (
    <div 
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
      className="flex h-screen w-full text-white font-sans antialiased relative overflow-hidden selection:bg-pink-500 selection:text-white bg-[#0f0524]"
    >
      {isDraggingFile && (<div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm border-4 border-dashed border-purple-500 flex flex-col items-center justify-center animate-in fade-in duration-200 pointer-events-none"><Upload size={64} className="text-purple-500 mb-4 animate-bounce" /><h2 className="text-3xl font-bold text-white">Solte seu arquivo aqui</h2><p className="text-purple-300 mt-2">{currentFolder ? 'Upload dentro da pasta atual' : 'Upload na raiz'}</p></div>)}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none"><div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px]"></div><div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]"></div></div>

      {/* MODAIS (MANTIDOS) */}
      {showMoveModal && movingItem && (<div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"><div className="bg-[#1a1033] border border-purple-500/30 p-6 rounded-2xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200"><button onClick={() => setShowMoveModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20}/></button><h2 className="text-xl font-bold mb-4 flex items-center gap-2"><FolderInput className="text-yellow-500" /> Mover Item</h2><p className="text-gray-400 text-sm mb-4">Para onde você quer mover <strong>"{movingItem.name}"</strong>?</p><div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar"><button onClick={() => handleMoveItem(null)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${movingItem.folderId === null ? 'bg-purple-600/20 border border-purple-500 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}><Folder size={18} className="text-purple-400" /> <span className="font-bold text-sm">Raiz (Início)</span>{movingItem.folderId === null && <CheckCircle size={16} className="ml-auto text-purple-400"/>}</button>{items.filter(i => i.type === 'folder' && i.id !== movingItem.id).map(folder => (<button key={folder.id} onClick={() => handleMoveItem(folder.id)} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${movingItem.folderId === folder.id ? 'bg-yellow-600/20 border border-yellow-500 text-white' : 'bg-white/5 hover:bg-white/10 text-gray-300'}`}><Folder size={18} className="text-yellow-500" /> <span className="font-bold text-sm">{folder.name}</span>{movingItem.folderId === folder.id && <CheckCircle size={16} className="ml-auto text-yellow-500"/>}</button>))}</div></div></div>)}
      {showLimitModal && (<div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"><div className="bg-[#1a0505] border border-red-500/50 w-full max-w-sm rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.3)] p-6 text-center"><div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20"><AlertTriangle size={32} className="text-red-500" /></div><h2 className="text-2xl font-black text-white mb-2">Arquivo Muito Grande!</h2><p className="text-gray-300 text-sm mb-4">O limite máximo é de <strong className="text-red-400">{MAX_FILE_SIZE_MB}MB</strong> por arquivo.</p><div className="bg-red-500/10 rounded-lg p-3 mb-6 border border-red-500/20"><p className="text-xs text-red-300 font-mono">Tamanho do arquivo: {attemptedFileSize} MB</p></div><button onClick={() => setShowLimitModal(false)} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-red-900/40 active:scale-95">ENTENDI, VOU REDUZIR</button></div></div>)}
      {showFolderModal && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-[#1a1033] border border-purple-500/30 p-6 rounded-2xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200"><button onClick={() => setShowFolderModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20}/></button><h2 className="text-2xl font-bold mb-1 flex items-center gap-2"><FolderPlus className="text-yellow-500" /> Nova Pasta</h2><form onSubmit={handleCreateFolder} className="space-y-4 mt-6"><div><label className="block text-xs font-bold uppercase text-purple-300 mb-1">Nome da Pasta</label><input type="text" autoFocus placeholder="Ex: Faculdade" className="w-full bg-black/40 border border-purple-500/20 rounded-xl p-3 outline-none focus:border-yellow-500 transition-colors" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} required /></div><button type="submit" className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 p-3 rounded-xl font-bold shadow-lg shadow-yellow-500/25 hover:scale-[1.02] transition-transform text-black">CRIAR PASTA</button></form></div></div>)}
      {showAccountModal && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"><div className="bg-[#130b24] border border-purple-500/30 w-full max-w-2xl rounded-3xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row h-[500px]"><button onClick={() => setShowAccountModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"><X size={24}/></button><div className="w-full md:w-1/3 bg-black/20 border-b md:border-b-0 md:border-r border-white/5 p-6 flex flex-col items-center text-center"><div className="relative group cursor-pointer mb-4"><div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 p-1"><div className="w-full h-full rounded-full bg-black overflow-hidden flex items-center justify-center"><User size={40} className="text-purple-300" /></div></div></div><h3 className="font-bold text-lg text-white">Admin User</h3><p className="text-xs text-purple-300 mb-6">admin@poplink.me</p><div className="w-full space-y-2"><div className="bg-white/5 p-3 rounded-xl border border-white/5"><p className="text-[10px] text-gray-400 uppercase font-bold">Plano Atual</p><p className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">{planDetails.name}</p></div></div></div><div className="flex-1 p-8 overflow-y-auto"><h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><User className="text-pink-500"/> Minha Conta</h2><div className="space-y-8"><div><h3 className="text-sm font-bold text-purple-300 uppercase mb-3 flex items-center gap-2"><CreditCard size={14}/> Assinatura</h3><div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/20 rounded-xl p-5"><div className="flex justify-between items-center mb-4"><div><p className="text-sm text-gray-300">Vencimento da fatura</p><p className="font-bold text-white flex items-center gap-2"><Calendar size={14} className="text-pink-500"/> {planDetails.expires}</p></div><div className="text-right"><p className="text-sm text-gray-300">Espaço Usado</p><p className="font-bold text-white">{planDetails.used} / {planDetails.limit}</p></div></div><div className="w-full bg-black/50 rounded-full h-2 mb-4 overflow-hidden"><div className="bg-gradient-to-r from-green-400 to-blue-500 h-full w-[25%]"></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><button className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs"><RefreshCw size={16} /> RENOVAR</button><button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-3 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-xs"><ChevronUp size={16} /> FAZER UPGRADE</button></div></div></div><div><h3 className="text-sm font-bold text-purple-300 uppercase mb-3 flex items-center gap-2"><Lock size={14}/> Segurança</h3><div className="grid grid-cols-2 gap-4"><input type="password" placeholder="Nova Senha" className="bg-black/30 border border-white/10 rounded-lg p-3 text-sm focus:border-pink-500 outline-none" /><button className="bg-white/10 hover:bg-white/20 text-white text-sm font-bold rounded-lg p-3">SALVAR SENHA</button></div></div></div></div></div></div>)}
      {showShortenModal && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-[#1a1033] border border-purple-500/30 p-6 rounded-2xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200"><button onClick={() => setShowShortenModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20}/></button><h2 className="text-2xl font-bold mb-1 flex items-center gap-2"><Scissors className="text-pink-500" /> Encurtar Link</h2><form onSubmit={handleShortenLink} className="space-y-4 mt-6"><input type="url" placeholder="URL de Destino" className="w-full bg-black/40 border border-purple-500/20 rounded-xl p-3 outline-none focus:border-pink-500" value={urlToShorten} onChange={e => setUrlToShorten(e.target.value)} required /><div className="flex items-center"><span className="bg-white/5 border border-r-0 border-purple-500/20 rounded-l-xl p-3 text-gray-400 text-sm">poplink.me/</span><input type="text" placeholder="meu-arquivo" className="flex-1 bg-black/40 border border-purple-500/20 rounded-r-xl p-3 outline-none focus:border-pink-500" value={customAlias} onChange={e => setCustomAlias(e.target.value)} /></div><button type="submit" className="w-full bg-gradient-to-r from-pink-500 to-purple-600 p-3 rounded-xl font-bold shadow-lg hover:scale-[1.02]">ENCURTAR AGORA 🚀</button></form></div></div>)}
      {showEditModal && editingItem && (<div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"><div className="bg-[#1a1033] border border-purple-500/30 p-6 rounded-2xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200"><button onClick={() => setShowEditModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20}/></button><h2 className="text-2xl font-bold mb-1 flex items-center gap-2"><Edit2 className="text-cyan-500" /> Editar</h2><form onSubmit={handleEditSave} className="space-y-4 mt-6"><input type="text" className="w-full bg-black/40 border border-purple-500/20 rounded-xl p-3 outline-none focus:border-cyan-500" value={editName} onChange={e => setEditName(e.target.value)} required /><div className="flex items-center"><span className="bg-white/5 border border-r-0 border-purple-500/20 rounded-l-xl p-3 text-gray-400 text-sm">poplink.me/</span><input type="text" className="flex-1 bg-black/40 border border-purple-500/20 rounded-r-xl p-3 outline-none focus:border-cyan-500" value={editAlias} onChange={e => setEditAlias(e.target.value)} /></div>{editingItem.type === 'link_shortened' ? <input type="url" className="w-full bg-black/40 border border-purple-500/20 rounded-xl p-3 outline-none focus:border-cyan-500" value={editUrl} onChange={e => setEditUrl(e.target.value)} required /> : <input type="file" ref={fileInputRef} className="w-full bg-black/40 border border-purple-500/20 rounded-xl p-3 outline-none focus:border-cyan-500 text-sm text-gray-400" />}<button type="submit" disabled={uploading} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 p-3 rounded-xl font-bold hover:scale-[1.02]">{uploading ? <Loader2 className="animate-spin" /> : 'SALVAR ALTERAÇÕES'}</button></form></div></div>)}

      <div className="md:hidden absolute top-0 left-0 w-full p-4 flex justify-between items-center z-50 bg-[#0f0524]/80 backdrop-blur-md border-b border-white/5">
         <Logo />
         <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 bg-white/10 rounded-lg text-white">
           {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
         </button>
      </div>

      <aside className={`w-72 fixed md:relative z-40 bg-[#0f0524] md:bg-white/5 backdrop-blur-2xl border-r border-white/5 flex flex-col p-6 h-full transition-transform duration-300 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="hidden md:flex mb-8"><Logo /></div>
        <button onClick={() => setShowAccountModal(true)} className="w-full bg-white hover:bg-gray-200 text-black px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-white/10 mb-16"><User size={18} /> MINHA CONTA</button>
        <nav className="space-y-2 flex-1">
          {menuItems.map((item) => (
            <button key={item.id} onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); setFolderPath([]); setCurrentFolder(null); }} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-bold ${activeTab === item.id ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20' : 'bg-transparent text-gray-300 hover:text-white hover:bg-white/10' }`}>
              <span className="text-xl leading-none">{item.emoji}</span><span className="font-bold">{item.label}</span>
            </button>
          ))}
          <div className="pt-4 border-t border-white/5 my-4"></div>
          <button onClick={() => setActiveTab('referrals')} className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 font-bold border ${activeTab === 'referrals' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 shadow-lg shadow-yellow-500/20' : 'bg-transparent border-transparent text-yellow-600 hover:text-yellow-400 hover:bg-yellow-500/10'}`}>
            <Gift size={18} className={activeTab === 'referrals' ? "text-yellow-400" : "text-yellow-600"} /><span>INDICAÇÃO</span>{activeTab !== 'referrals' && <span className="ml-auto bg-yellow-500/20 text-yellow-400 text-[10px] px-2 py-0.5 rounded-full border border-yellow-500/30">R$</span>}
          </button>
        </nav>
        <div onClick={() => setShowAccountModal(true)} className="mt-auto mb-6 p-4 rounded-2xl bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-white/10 relative overflow-hidden group cursor-pointer shadow-lg shadow-purple-900/30 hover:scale-[1.02] transition-transform">
           <div className="flex items-center gap-3 mb-3 relative z-10"><div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg text-white shadow-md shadow-orange-500/20"><Zap size={18} fill="currentColor" /></div><p className="font-black text-base text-white tracking-tight">Plano Pro</p></div><button className="w-full py-2.5 bg-white text-purple-900 font-black text-sm rounded-xl hover:bg-purple-50 transition-colors relative z-10 shadow-md">Upgrade Agora</button>
        </div>
      </aside>

      <main className="flex-1 relative z-10 overflow-y-auto overflow-x-hidden p-4 md:p-12 pt-24 md:pt-12 w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight drop-shadow-lg">
              {activeTab === 'dashboard' && 'Visão Geral'}
              {activeTab === 'links' && 'Gerenciar Links'}
              {activeTab === 'files' && 'Biblioteca'}
              {activeTab === 'analytics' && 'Estatísticas'}
              {activeTab === 'referrals' && 'Programa de Indicação'}
            </h2>
            <div className="flex items-center gap-2 text-purple-300 text-sm font-medium mt-1">
               <span className={`cursor-pointer hover:text-white flex items-center gap-1 ${!currentFolder ? 'text-white font-bold' : ''}`} onClick={goHome}><Folder size={14}/> Raiz</span>
               {folderPath.map((folder, i) => (
                  <React.Fragment key={folder.id}>
                    <span>/</span>
                    <span className={`cursor-pointer hover:text-white ${i === folderPath.length - 1 ? 'text-white font-bold' : ''}`} onClick={() => {
                       if(i < folderPath.length - 1) {
                         const newPath = folderPath.slice(0, i + 1);
                         setFolderPath(newPath);
                         setCurrentFolder(folder.id);
                       }
                    }}>{folder.name}</span>
                  </React.Fragment>
               ))}
            </div>
          </div>
          
          <div className="flex gap-3 w-full md:w-auto items-center">
            {(activeTab === 'files' || activeTab === 'links' || activeTab === 'dashboard') && (
               <button onClick={() => setShowFolderModal(true)} className="flex-1 md:flex-none bg-white/5 hover:bg-white/10 border border-white/10 text-yellow-400 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all" title="Nova Pasta">
                 <FolderPlus size={18} />
               </button>
            )}
            <button onClick={() => setShowShortenModal(true)} className="flex-1 md:flex-none bg-white/10 hover:bg-white/20 border border-white/10 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all"><Scissors size={18} /> ENCURTAR</button>
            <label className="flex-1 md:flex-none cursor-pointer bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:scale-105 hover:shadow-purple-500/50 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 transition-all active:scale-95">
              {uploading ? <Loader2 className="animate-spin" /> : <Plus size={20} strokeWidth={3} />}
              {uploading ? 'ENVIANDO...' : 'UPLOAD'}
              <input type="file" className="hidden" onChange={handleFileInputChange} disabled={uploading} />
            </label>
          </div>
        </div>

        {uploading && !showEditModal && !showLimitModal && (
          <div className="w-full bg-white/5 rounded-xl p-4 mb-8 border border-purple-500/30 shadow-lg shadow-purple-500/20 animate-in fade-in slide-in-from-top-4 flex items-center gap-4">
            <div className="flex-1"><div className="flex justify-between text-sm mb-2 font-bold"><span className="text-purple-200">Enviando arquivo para a nuvem...</span><span className="text-white">{progress.toFixed(0)}%</span></div><div className="h-3 bg-white/10 rounded-full overflow-hidden p-0.5"><div className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full transition-all duration-300" style={{width: `${progress}%`}}></div></div></div>
            <button onClick={cancelUpload} className="bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white p-2 rounded-full transition-colors" title="Cancelar Upload"><XCircle size={24} /></button>
          </div>
        )}

        {activeTab === 'referrals' ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-yellow-500/30 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="max-w-lg"><div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-bold uppercase mb-4"><DollarSign size={14}/> Ganhe R$ Recorrentes</div><h3 className="text-3xl font-black text-white mb-4 leading-tight">Convide amigos e ganhe <span className="text-yellow-400">20% de comissão</span> todo mês.</h3><p className="text-purple-200 mb-6">Cada amigo que assinar o Poplink pelo seu link gera comissão para você todos os meses enquanto ele for assinante.</p><div className="bg-black/40 border border-white/10 p-2 rounded-xl flex items-center gap-2"><div className="bg-white/5 px-4 py-2 rounded-lg text-gray-400 text-sm font-mono flex-1 truncate">{referralData.link}</div><button onClick={() => navigator.clipboard.writeText(referralData.link)} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 py-2 rounded-lg transition-colors flex items-center gap-2"><Copy size={16}/> COPIAR</button></div></div>
                <div className="grid grid-cols-2 gap-4 w-full md:w-auto"><div className="bg-black/40 p-5 rounded-2xl border border-white/5 text-center"><p className="text-gray-400 text-xs font-bold uppercase mb-1">Ganhos Totais</p><p className="text-2xl font-black text-green-400">{referralData.earnings}</p></div><div className="bg-black/40 p-5 rounded-2xl border border-white/5 text-center"><p className="text-gray-400 text-xs font-bold uppercase mb-1">A Receber</p><p className="text-2xl font-black text-yellow-400">{referralData.pending}</p></div><div className="col-span-2 bg-black/40 p-5 rounded-2xl border border-white/5 flex items-center justify-between"><div><p className="text-gray-400 text-xs font-bold uppercase mb-1">Indicações Ativas</p><p className="text-2xl font-black text-white">{referralData.referrals}</p></div><div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center text-purple-400"><Users size={24}/></div></div></div>
             </div>
          </div>
        ) : activeTab === 'analytics' ? (
          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-wrap items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5 w-fit">{['Hoje', 'Ontem', '7 dias', 'Este Mês'].map((label) => (<button key={label} onClick={() => setDateRange(label)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${dateRange === label ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'text-purple-200 hover:bg-white/10'}`}>{label}</button>))}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"><StatCard icon={MousePointer2} label="Cliques Totais" value={stats.clicks} colorClass="from-cyan-400 to-blue-500" /><StatCard icon={FileText} label="Arquivos" value={stats.filesCount} colorClass="from-purple-500 to-indigo-500" /><StatCard icon={LinkIcon} label="Links Encurtados" value={stats.links} colorClass="from-pink-500 to-rose-500" /><StatCard icon={Upload} label="Armazenamento" value={`${(stats.filesCount * 2.5).toFixed(1)} MB`} colorClass="from-amber-400 to-orange-500" /></div>
            <div className="flex flex-col items-center justify-center py-20 bg-white/5 rounded-2xl border border-dashed border-purple-500/20 text-center"><div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mb-4 text-purple-400"><BarChart3 size={32} /></div><h3 className="text-lg font-bold text-white mb-2">Relatórios Detalhados</h3><p className="text-sm text-purple-200/60 max-w-sm mb-6">Gráficos em breve.</p><div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full"><AlertCircle size={12} /> Aguardando dados</div></div>
          </div>
        ) : (
          <div className="space-y-6 pb-10">
            {activeTab === 'dashboard' && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10"><StatCard icon={MousePointer2} label="Cliques Totais" value={stats.clicks} colorClass="from-cyan-400 to-blue-500" /><StatCard icon={FileText} label="Arquivos" value={stats.filesCount} colorClass="from-purple-500 to-indigo-500" onClick={() => setActiveTab('files')} /><StatCard icon={LinkIcon} label="Links Encurtados" value={stats.links} colorClass="from-pink-500 to-rose-500" onClick={() => setActiveTab('links')} /><StatCard icon={Upload} label="Armazenamento" value={`${(stats.filesCount * 2.5).toFixed(1)} MB`} colorClass="from-amber-400 to-orange-500" /></div>}
            {activeTab === 'dashboard' && <div className="mt-8 mb-6"><h3 className="text-xl font-bold mb-4">Atividade Recente</h3><div className="relative w-full max-w-md group"><Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-purple-300 group-focus-within:text-pink-500 transition-colors" size={20} /><input type="text" placeholder="Buscar arquivo ou link..." className="w-full bg-white/5 border border-purple-500/50 rounded-xl py-3 pl-12 pr-4 text-base focus:outline-none focus:border-pink-500 focus:bg-white/10 focus:shadow-[0_0_15px_rgba(236,72,153,0.3)] transition-all placeholder:text-gray-400" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>}
            
            {currentFolder && !searchQuery && (
              <button onClick={goBack} className="flex items-center gap-2 text-purple-300 hover:text-white mb-4 font-bold text-sm">
                <ArrowLeft size={16}/> Voltar
              </button>
            )}

            <div className="space-y-4">
              {displayItems.length > 0 ? displayItems.map((item) => (
                <PurpleGlassCard 
                  key={item.id} 
                  
                  // CLICK = ENTRAR NA PASTA
                  onClick={item.type === 'folder' ? () => enterFolder(item) : undefined}
                  
                  className={`p-4 flex flex-col md:flex-row items-center justify-between group gap-4 transition-all 
                    ${item.type === 'folder' ? 'border-yellow-500/20 hover:border-yellow-500/50 bg-yellow-900/10' : ''}
                  `}
                >
                  <div className="flex items-center gap-5 w-full md:w-auto overflow-hidden">
                    <div className={`w-12 h-12 flex-shrink-0 rounded-xl bg-gradient-to-br border border-white/10 flex items-center justify-center font-bold text-lg text-white transition-all shadow-md ${item.type === 'link_shortened' ? 'from-cyan-600 to-blue-600' : (item.type === 'folder' ? 'from-yellow-600 to-orange-600' : 'from-gray-800 to-black')}`}>
                      {item.type === 'link_shortened' ? <LinkIcon size={20} /> : (item.type === 'folder' ? <Folder size={20} /> : <FileText size={20} />)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className={`font-bold text-lg truncate ${item.type === 'folder' ? 'text-yellow-400' : 'text-white'}`}>{item.name}</h4>
                      {item.type !== 'folder' && (
                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3 mt-1">
                          <a href={item.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-xs font-mono text-cyan-400 bg-cyan-900/30 px-2 py-0.5 rounded hover:bg-cyan-900/50 cursor-pointer transition-colors flex items-center gap-1 truncate max-w-[250px] border border-cyan-500/30 w-fit">{item.poplink} <ExternalLink size={10}/></a>
                          {item.type !== 'link_shortened' && <span className="text-xs text-gray-400 whitespace-nowrap">{item.size} MB</span>}
                          {item.type === 'link_shortened' && <span className="text-xs text-gray-500 truncate max-w-[200px]">{item.originalUrl}</span>}
                        </div>
                      )}
                      {item.type === 'folder' && <span className="text-xs text-yellow-600 uppercase font-bold tracking-wider">PASTA</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <TooltipButton onClick={(e: any) => { e.stopPropagation(); openEditModal(item); }} icon={Edit2} label="EDITAR" className="p-2 rounded-lg text-purple-300 hover:text-cyan-500 hover:bg-cyan-500/20 transition-colors"/>
                    
                    {/* BOTÃO MOVER (Pasta com setinha) */}
                    {item.type !== 'folder' && (
                      <TooltipButton onClick={(e: any) => { e.stopPropagation(); openMoveModal(item); }} icon={FolderInput} label="MOVER" className="p-2 rounded-lg text-purple-300 hover:text-yellow-500 hover:bg-yellow-500/20 transition-colors"/>
                    )}
                    
                    {item.type !== 'folder' && <TooltipButton onClick={(e: any) => { e.stopPropagation(); navigator.clipboard.writeText(item.originalUrl); }} icon={Copy} label="COPIAR" className="p-2 rounded-lg text-purple-300 hover:text-white hover:bg-white/10 transition-colors"/>}
                    
                    {item.type === 'folder' ? (
                       <TooltipButton onClick={(e: any) => { e.stopPropagation(); enterFolder(item); }} icon={CornerDownRight} label="ABRIR" className="p-2 rounded-lg text-yellow-400 hover:text-white hover:bg-yellow-500/20 transition-colors"/>
                    ) : null}
                    
                    <TooltipButton onClick={(e: any) => { e.stopPropagation(); handleDelete(item); }} icon={Trash2} label="EXCLUIR" className="p-2 rounded-lg text-purple-300 hover:text-pink-500 hover:bg-pink-500/20 transition-colors"/>
                  </div>
                </PurpleGlassCard>
              )) : <div className="h-48 flex flex-col items-center justify-center border-2 border-dashed border-purple-500/30 rounded-3xl bg-purple-900/5 text-purple-300 p-6 text-center"><p className="font-bold mb-2">Nada encontrado.</p><p className="text-sm opacity-70">{searchQuery ? 'Tente buscar com outro termo.' : (currentFolder ? 'Esta pasta está vazia.' : 'Faça um upload, crie um link ou uma nova pasta!')}</p></div>}
             </div>
          </div>
        )}
      </main>
    </div>
  );
}