
import React, { useState, useEffect } from 'react';
import { X, Key, Lock, Save, Loader2, CheckCircle2, AlertCircle, Plus, Trash2, Database, Globe, RefreshCw, ClipboardList, Building2 } from 'lucide-react';
import { db } from '../services/db';
import { auth } from '../firebase';
import { changePassword } from '../services/authService';
import { UserAccount, AppSettings, GeminiKey, SupabaseConfig } from '../types';
import { GoogleGenAI } from "@google/genai";

import { supabaseExportService } from '../services/supabaseExportService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
}

const AppSettingsModal: React.FC<Props> = ({ isOpen, onClose, currentUser }) => {
  const [geminiKeys, setGeminiKeys] = useState<GeminiKey[]>([]);
  const [supabaseConfigs, setSupabaseConfigs] = useState<SupabaseConfig[]>([]);
  const [clinicName, setClinicName] = useState('TCM PRO');
  const [clinicAddress, setClinicAddress] = useState('Jl. Kesehatan No. 123, Jakarta');
  const [clinicPhone, setClinicPhone] = useState('+62 812 3456 7890');
  const [exportTableName, setExportTableName] = useState('patients');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [detectedTables, setDetectedTables] = useState<string[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [status, setStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchSettings = async () => {
        setIsInitialLoading(true);
        try {
          const settings = await db.settings.get();
          if (settings) {
            setGeminiKeys(settings.geminiApiKeys || []);
            setSupabaseConfigs(settings.supabaseConfigs || []);
            if (settings.clinicDetails) {
              setClinicName(settings.clinicDetails.name || 'TCM PRO');
              setClinicAddress(settings.clinicDetails.address || 'Jl. Kesehatan No. 123, Jakarta');
              setClinicPhone(settings.clinicDetails.phone || '+62 812 3456 7890');
            }
          }
        } catch (error: any) {
          console.error("Error fetching settings:", error);
          const msg = !auth.currentUser 
            ? 'Gagal mengambil pengaturan Cloud karena Anda tidak login. Gunakan Login Google atau Akun Klinik.' 
            : 'Gagal mengambil pengaturan. Pastikan koneksi internet stabil.';
          setStatus({ type: 'error', message: msg });
        } finally {
          setIsInitialLoading(false);
        }
      };
      fetchSettings();
      setStatus(null);
    }
  }, [isOpen]);

  const handleSaveSettings = async () => {
    setIsLoading(true);
    setStatus(null);
    try {
      const success = await db.settings.save({
        geminiApiKeys: geminiKeys,
        supabaseConfigs: supabaseConfigs,
        clinicDetails: {
          name: clinicName,
          address: clinicAddress,
          phone: clinicPhone
        },
        updatedAt: Date.now()
      });
      if (success) {
        setStatus({ type: 'success', message: 'Pengaturan berhasil disimpan.' });
      } else {
        setStatus({ type: 'error', message: 'Gagal menyimpan pengaturan.' });
      }
    } catch (error: any) {
      console.error("Error saving settings:", error);
      const msg = !auth.currentUser 
        ? 'Gagal menyimpan. Anda harus Login (Google/Akun Klinik) untuk menyimpan ke Cloud.' 
        : 'Gagal menyimpan pengaturan. Pastikan Anda memiliki izin.';
      setStatus({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const addGeminiKey = () => {
    if (geminiKeys.length >= 20) return;
    setGeminiKeys([...geminiKeys, { key: '', label: `Key ${geminiKeys.length + 1}`, status: 'untested' }]);
  };

  const removeGeminiKey = (index: number) => {
    setGeminiKeys(geminiKeys.filter((_, i) => i !== index));
  };

  const updateGeminiKey = (index: number, field: keyof GeminiKey, value: string) => {
    const newKeys = [...geminiKeys];
    newKeys[index] = { ...newKeys[index], [field]: value };
    setGeminiKeys(newKeys);
  };

  const testGeminiKey = async (index: number) => {
    const keyToTest = geminiKeys[index].key;
    if (!keyToTest) return;

    const newKeys = [...geminiKeys];
    newKeys[index].status = 'untested';
    setGeminiKeys(newKeys);

    try {
      const genAI = new GoogleGenAI({ apiKey: keyToTest });
      const model = genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "test",
      });
      await model;
      newKeys[index].status = 'active';
      newKeys[index].lastError = undefined;
    } catch (error: any) {
      newKeys[index].status = 'error';
      newKeys[index].lastError = error.message || 'Unknown error';
    }
    setGeminiKeys([...newKeys]);
  };

  const addSupabaseConfig = () => {
    if (supabaseConfigs.length >= 20) return;
    setSupabaseConfigs([...supabaseConfigs, { url: '', key: '', label: `Account ${supabaseConfigs.length + 1}`, status: 'untested' }]);
  };

  const removeSupabaseConfig = (index: number) => {
    setSupabaseConfigs(supabaseConfigs.filter((_, i) => i !== index));
  };

  const updateSupabaseConfig = (index: number, field: keyof SupabaseConfig, value: string) => {
    const newConfigs = [...supabaseConfigs];
    newConfigs[index] = { ...newConfigs[index], [field]: value };
    setSupabaseConfigs(newConfigs);
  };

  const testSupabaseConfig = async (index: number) => {
    const config = supabaseConfigs[index];
    if (!config.url || !config.key) return;

    const newConfigs = [...supabaseConfigs];
    newConfigs[index].status = 'untested';
    setSupabaseConfigs(newConfigs);

    try {
      const response = await fetch(`${config.url}/rest/v1/?apikey=${config.key}`, {
        method: 'GET',
        headers: { 'apikey': config.key }
      });
      if (response.ok) {
        newConfigs[index].status = 'active';
        newConfigs[index].lastError = undefined;
      } else {
        throw new Error(`HTTP Error: ${response.status}`);
      }
    } catch (error: any) {
      newConfigs[index].status = 'error';
      newConfigs[index].lastError = error.message || 'Unknown error';
    }
    setSupabaseConfigs([...newConfigs]);
  };

  const handleDetectTables = async () => {
    if (supabaseConfigs.length === 0) {
      setStatus({ type: 'error', message: 'Tambahkan minimal satu akun Supabase.' });
      return;
    }
    
    setIsDetecting(true);
    setStatus(null);
    try {
      // Detect tables from the first active config
      const activeConfig = supabaseConfigs.find(c => c.status === 'active') || supabaseConfigs[0];
      const tables = await supabaseExportService.detectTables(activeConfig);
      setDetectedTables(tables);
      if (tables.length > 0) {
        setExportTableName(tables[0]);
        setStatus({ type: 'success', message: `Berhasil mendeteksi ${tables.length} tabel.` });
      } else {
        setStatus({ type: 'error', message: 'Tidak ada tabel yang terdeteksi.' });
      }
    } catch (error: any) {
      setStatus({ type: 'error', message: `Gagal mendeteksi tabel: ${error.message}` });
    } finally {
      setIsDetecting(false);
    }
  };

  const handleCollectiveExport = async () => {
    if (supabaseConfigs.length === 0) {
      setStatus({ type: 'error', message: 'Tambahkan minimal satu akun Supabase untuk ekspor.' });
      return;
    }
    
    setIsExporting(true);
    setExportProgress('Memulai ekspor kolektif...');
    setStatus(null);
    try {
      const results = await supabaseExportService.exportCollectiveData(
        supabaseConfigs, 
        exportTableName,
        (msg) => setExportProgress(msg)
      );
      const successCount = results.filter(r => r.success).length;
      setStatus({ 
        type: 'success', 
        message: `Ekspor selesai. Berhasil mengambil data dari ${successCount}/${results.length} akun.` 
      });
      setExportProgress('');
    } catch (error: any) {
      setStatus({ type: 'error', message: `Gagal melakukan ekspor kolektif: ${error.message}` });
      setExportProgress('');
    } finally {
      setIsExporting(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Password konfirmasi tidak cocok.' });
      return;
    }
    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: 'Password minimal 6 karakter.' });
      return;
    }

    setIsLoading(true);
    setStatus(null);
    
    try {
      // If Firebase Auth user is present, use updatePassword
      if (auth.currentUser) {
        const { updatePassword } = await import('firebase/auth');
        await updatePassword(auth.currentUser, newPassword);
        setStatus({ type: 'success', message: 'Password Akun Cloud berhasil diubah.' });
      } else {
        // Fallback for local admin
        const result = await changePassword(currentUser.username, newPassword);
        if (result.success) {
          setStatus({ type: 'success', message: 'Password Akun Lokal berhasil diubah.' });
        } else {
          throw new Error(result.message);
        }
      }
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error("Error changing password:", error);
      setStatus({ type: 'error', message: `Gagal mengubah password: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-purple-950/40 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-purple-100 flex justify-between items-center bg-purple-50/50">
          <h2 className="text-xl font-black text-purple-950 flex items-center gap-2 uppercase tracking-tighter">
            Pengaturan Sistem & API
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-purple-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-purple-400" />
          </button>
        </div>

        <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto scrollbar-hide">
          {isInitialLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-tcm-primary animate-spin" />
              <p className="text-xs font-black text-purple-400 uppercase tracking-widest">Mengambil Pengaturan Cloud...</p>
            </div>
          ) : (
            <>
              {!auth.currentUser && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-black text-amber-900 uppercase tracking-tight">Mode Akses Cepat Aktif</p>
                    <p className="text-[10px] text-amber-700 leading-relaxed font-bold">
                      Anda tidak login. Pengaturan API tidak dapat disimpan ke Cloud dan tidak akan muncul di perangkat lain. 
                      Silakan login untuk sinkronisasi data.
                    </p>
                  </div>
                </div>
              )}

              {status && (
                <div className={`p-4 rounded-2xl flex items-center gap-3 text-sm font-bold ${
                  status.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                }`}>
                  {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  {status.message}
                </div>
              )}

          {/* Gemini API Keys Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-950 font-black uppercase tracking-widest text-xs">
                <Key className="w-4 h-4" /> Gemini API Keys ({geminiKeys.length}/20)
              </div>
              <button 
                onClick={addGeminiKey}
                disabled={geminiKeys.length >= 20}
                className="flex items-center gap-1 text-[10px] font-black bg-purple-100 text-purple-600 px-3 py-1 rounded-full hover:bg-purple-200 transition-all disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> TAMBAH KEY
              </button>
            </div>
            
            <div className="space-y-3">
              {geminiKeys.map((item, index) => (
                <div key={index} className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-3">
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={item.label}
                      onChange={(e) => updateGeminiKey(index, 'label', e.target.value)}
                      className="w-1/3 bg-white border border-purple-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-tcm-primary"
                      placeholder="Label (e.g. Personal)"
                    />
                    <input 
                      type="password"
                      value={item.key}
                      onChange={(e) => updateGeminiKey(index, 'key', e.target.value)}
                      className="flex-1 bg-white border border-purple-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-tcm-primary"
                      placeholder="Gemini API Key..."
                    />
                    <div className="flex gap-1">
                      <button 
                        onClick={() => testGeminiKey(index)}
                        className="p-2 bg-white text-purple-600 rounded-xl border border-purple-100 hover:bg-purple-100 transition-all"
                        title="Test Connection"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => removeGeminiKey(index)}
                        className="p-2 bg-white text-rose-500 rounded-xl border border-purple-100 hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        item.status === 'active' ? 'bg-emerald-500' : 
                        item.status === 'error' ? 'bg-rose-500' : 'bg-purple-300'
                      }`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">
                        Status: {item.status}
                      </span>
                    </div>
                    {item.lastError && (
                      <span className="text-[10px] text-rose-500 italic max-w-[200px] truncate">
                        Err: {item.lastError}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {geminiKeys.length === 0 && (
                <p className="text-center py-4 text-xs text-purple-400 italic">Belum ada API Key yang ditambahkan.</p>
              )}
            </div>
          </section>

          <div className="h-px bg-purple-100" />

          {/* Supabase Configs Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-950 font-black uppercase tracking-widest text-xs">
                <Database className="w-4 h-4" /> Supabase Accounts ({supabaseConfigs.length}/20)
              </div>
              <button 
                onClick={addSupabaseConfig}
                disabled={supabaseConfigs.length >= 20}
                className="flex items-center gap-1 text-[10px] font-black bg-purple-100 text-purple-600 px-3 py-1 rounded-full hover:bg-purple-200 transition-all disabled:opacity-50"
              >
                <Plus className="w-3 h-3" /> TAMBAH AKUN
              </button>
            </div>
            
            <div className="space-y-3">
              {supabaseConfigs.map((item, index) => (
                <div key={index} className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-3">
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={item.label}
                      onChange={(e) => updateSupabaseConfig(index, 'label', e.target.value)}
                      className="w-1/4 bg-white border border-purple-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-tcm-primary"
                      placeholder="Label"
                    />
                    <input 
                      type="text"
                      value={item.url}
                      onChange={(e) => updateSupabaseConfig(index, 'url', e.target.value)}
                      className="flex-1 bg-white border border-purple-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-tcm-primary"
                      placeholder="Supabase URL (https://...)"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="password"
                      value={item.key}
                      onChange={(e) => updateSupabaseConfig(index, 'key', e.target.value)}
                      className="flex-1 bg-white border border-purple-100 rounded-xl px-3 py-2 text-xs outline-none focus:border-tcm-primary"
                      placeholder="Supabase Anon Key..."
                    />
                    <div className="flex gap-1">
                      <button 
                        onClick={() => testSupabaseConfig(index)}
                        className="p-2 bg-white text-purple-600 rounded-xl border border-purple-100 hover:bg-purple-100 transition-all"
                        title="Test Connection"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => removeSupabaseConfig(index)}
                        className="p-2 bg-white text-rose-500 rounded-xl border border-purple-100 hover:bg-rose-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        item.status === 'active' ? 'bg-emerald-500' : 
                        item.status === 'error' ? 'bg-rose-500' : 'bg-purple-300'
                      }`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">
                        Status: {item.status}
                      </span>
                    </div>
                    {item.lastError && (
                      <span className="text-[10px] text-rose-500 italic max-w-[200px] truncate">
                        Err: {item.lastError}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {supabaseConfigs.length === 0 && (
                <p className="text-center py-4 text-xs text-purple-400 italic">Belum ada akun Supabase yang ditambahkan.</p>
              )}
            </div>
          </section>

          <div className="h-px bg-purple-100" />

          {/* Collective Export Section */}
          <section className="space-y-4 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
            <div className="flex items-center gap-2 text-indigo-950 font-black uppercase tracking-widest text-xs">
              <ClipboardList className="w-4 h-4" /> Ekspor Kolektif Supabase
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest ml-1">Nama Tabel Supabase</label>
                  <button 
                    onClick={handleDetectTables}
                    disabled={isDetecting || supabaseConfigs.length === 0}
                    className="text-[9px] font-black text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    {isDetecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    DETEKSI TABEL
                  </button>
                </div>
                
                {detectedTables.length > 0 ? (
                  <select 
                    value={exportTableName}
                    onChange={(e) => setExportTableName(e.target.value)}
                    className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-xs outline-none focus:border-indigo-500 font-bold"
                  >
                    {detectedTables.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <input 
                    type="text"
                    value={exportTableName}
                    onChange={(e) => setExportTableName(e.target.value)}
                    className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-xs outline-none focus:border-indigo-500"
                    placeholder="Contoh: patients, records, dll."
                  />
                )}
              </div>

              {exportProgress && (
                <div className="p-3 bg-white/50 rounded-xl border border-indigo-100 animate-pulse">
                  <p className="text-[10px] font-bold text-indigo-600 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {exportProgress}
                  </p>
                </div>
              )}

              <button 
                onClick={handleCollectiveExport}
                disabled={isExporting || supabaseConfigs.length === 0}
                className="w-full bg-indigo-600 text-white font-black py-3 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-900/20"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                EKSPOR SEMUA DATA KE EXCEL
              </button>
              <p className="text-[9px] text-indigo-400 italic text-center">
                Sistem akan mengambil data dari semua akun Supabase di atas dan menggabungkannya ke dalam satu file Excel dengan sheet terpisah.
              </p>
            </div>
          </section>
          
          <div className="h-px bg-purple-100" />

          {/* Clinic Details Section */}
          <section className="space-y-4">
            <div className="flex items-center gap-2 text-purple-950 font-black uppercase tracking-widest text-xs">
              <Building2 className="w-4 h-4" /> Detail Klinik (Untuk Invoice)
            </div>
            <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-1">Nama Klinik</label>
                <input 
                  type="text"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  className="w-full bg-white border border-purple-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-tcm-primary transition-all font-bold"
                  placeholder="Contoh: TCM PRO Clinic"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-1">Alamat Klinik</label>
                <textarea 
                  value={clinicAddress}
                  onChange={(e) => setClinicAddress(e.target.value)}
                  className="w-full bg-white border border-purple-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-tcm-primary transition-all resize-none"
                  placeholder="Alamat lengkap klinik..."
                  rows={2}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-1">Nomor Telepon</label>
                <input 
                  type="text"
                  value={clinicPhone}
                  onChange={(e) => setClinicPhone(e.target.value)}
                  className="w-full bg-white border border-purple-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-tcm-primary transition-all"
                  placeholder="+62 ..."
                />
              </div>
            </div>
          </section>

          <button 
            onClick={handleSaveSettings}
            disabled={isLoading}
            className="w-full bg-tcm-primary text-white font-black py-4 rounded-2xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
            SIMPAN SEMUA PENGATURAN API
          </button>

          <div className="h-px bg-purple-100" />

          {/* Password Section */}
          {currentUser && (
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-purple-950 font-black uppercase tracking-widest text-xs">
                <Lock className="w-4 h-4" /> Keamanan Akun
              </div>
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-4">
                <p className="text-[10px] text-purple-400 font-bold leading-relaxed italic">
                  Gunakan formulir ini untuk mengubah password akun Anda. Password saat ini tidak ditampilkan demi keamanan.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-1">Password Baru</label>
                    <input 
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white border border-purple-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-tcm-primary transition-all"
                      placeholder="Min. 6 karakter"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest ml-1">Konfirmasi</label>
                    <input 
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white border border-purple-100 rounded-2xl px-4 py-3 text-sm outline-none focus:border-tcm-primary transition-all"
                      placeholder="Ulangi password"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleChangePassword}
                  disabled={isLoading || !newPassword}
                  className="w-full bg-purple-950 text-white font-black py-4 rounded-2xl hover:bg-black active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                  UBAH PASSWORD
                </button>
              </div>
            </section>
          )}
            </>
          )}
        </div>

        <div className="p-6 bg-purple-50/50 border-t border-purple-100 text-center">
          <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">
            TCM PRO v2.0 • Enterprise API Management
          </p>
        </div>
      </div>
    </div>
  );
};

export default AppSettingsModal;
