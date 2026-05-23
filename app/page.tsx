"use client"
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Camera, FileText, Plus, Trash2, Home, User, Ruler, 
  Search, LogIn, Users, BookOpen, LogOut, Loader2, Save, Phone
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function DivanniApp() {
  // --- ESTADOS DE NAVEGAÇÃO E AUTH ---
  const [session, setSession] = useState<any>(null);
  const [abaAtiva, setAbaAtiva] = useState<'home' | 'nova' | 'historico' | 'contatos'>('home');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // --- ESTADOS DO FORMULÁRIO ---
  const [clienteNome, setClienteNome] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [contatos, setContatos] = useState<{clientes: any[], fornecedores: any[]}>({clientes: [], fornecedores: []});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    if (session) carregarDados();
  }, [session]);

  const carregarDados = async () => {
    const { data: med } = await supabase.from('medicoes').select('*, clientes(*)').order('criado_at', { ascending: false });
    const { data: cli } = await supabase.from('clientes').select('*').order('nome_cliente');
    const { data: forn } = await supabase.from('fornecedores').select('*').order('nome');
    if (med) setHistorico(med);
    if (cli || forn) setContatos({ clientes: cli || [], fornecedores: forn || [] });
  };

  // --- FUNÇÕES DE AUTH ---
  const handleLogin = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Erro: " + error.message);
    setLoading(false);
  };

  const handleLogout = () => {
    supabase.auth.signOut();
    setSession(null);
  };

  // --- COMPONENTE: TELA DE LOGIN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-[#001f3f] flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <Ruler size={48} className="mx-auto text-[#d4af37] mb-2" />
            <h1 className="text-2xl font-serif tracking-widest text-[#001f3f]">DIVANNIDECOR</h1>
            <p className="text-gray-400 text-xs uppercase">Acesso Restrito</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="email" placeholder="E-mail" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border focus:border-[#d4af37]"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <input 
              type="password" placeholder="Senha" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border focus:border-[#d4af37]"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            <button className="w-full bg-[#001f3f] text-[#d4af37] p-4 rounded-2xl font-bold uppercase tracking-widest flex justify-center">
              {loading ? <Loader2 className="animate-spin" /> : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- FUNÇÃO PARA GERAR PDF (Melhorada para o histórico) ---
  const gerarPDFItem = (medicao: any) => {
    const doc = new jsPDF();
    doc.text(`DivanniDecor - Cliente: ${medicao.clientes?.nome_cliente}`, 14, 20);
    autoTable(doc, {
      startY: 30,
      head: [['Campo', 'Valor']],
      body: Object.entries(medicao.dados).map(([k, v]) => [k.toUpperCase(), String(v)]),
      theme: 'grid',
      headStyles: { fillColor: [0, 31, 63] }
    });
    doc.save(`Medida_${medicao.clientes?.nome_cliente}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* HEADER DINÂMICO */}
      <header className="bg-[#001f3f] text-white p-6 rounded-b-[40px] shadow-lg flex justify-between items-center">
        <div>
          <h1 className="text-lg font-serif tracking-widest text-[#d4af37]">DIVANNIDECOR</h1>
          <p className="text-[10px] opacity-60 uppercase">{abaAtiva}</p>
        </div>
        <button onClick={handleLogout} className="p-2 opacity-60 hover:opacity-100"><LogOut size={20} /></button>
      </header>

      <main className="p-4">
        {/* ABA: HOME / DASHBOARD */}
        {abaAtiva === 'home' && (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <button onClick={() => setAbaAtiva('nova')} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center gap-2">
              <Plus className="text-[#d4af37]" /> <span className="text-xs font-bold text-[#001f3f]">Nova Medida</span>
            </button>
            <button onClick={() => setAbaAtiva('historico')} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center gap-2">
              <Search className="text-[#d4af37]" /> <span className="text-xs font-bold text-[#001f3f]">Consultar</span>
            </button>
            <button onClick={() => setAbaAtiva('contatos')} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center gap-2 col-span-2">
              <Users className="text-[#d4af37]" /> <span className="text-xs font-bold text-[#001f3f]">Clientes e Fornecedores</span>
            </button>
          </div>
        )}

        {/* ABA: HISTÓRICO (CONSULTA) */}
        {abaAtiva === 'historico' && (
          <div className="space-y-4">
            <h2 className="font-bold text-[#001f3f] mb-4">Últimas Medições</h2>
            {historico.map((med) => (
              <div key={med.id} className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-[#d4af37] flex justify-between items-center">
                <div>
                  <p className="font-bold text-sm">{med.clientes?.nome_cliente}</p>
                  <p className="text-[10px] text-gray-400">{med.ambiente} - {new Date(med.criado_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => gerarPDFItem(med)} className="text-[#001f3f] p-2 bg-gray-50 rounded-full">
                  <FileText size={18} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ABA: CONTATOS (CLIENTES/FORNECEDORES) */}
        {abaAtiva === 'contatos' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-bold text-[#d4af37] mb-2 uppercase text-xs tracking-widest">Clientes</h3>
              <div className="space-y-2">
                {contatos.clientes.map(c => (
                  <div key={c.id} className="bg-white p-3 rounded-xl shadow-sm flex justify-between">
                    <span>{c.nome_cliente}</span>
                    <Phone size={16} className="text-gray-300" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-bold text-[#001f3f] mb-2 uppercase text-xs tracking-widest">Fornecedores</h3>
              <div className="space-y-2">
                {contatos.fornecedores.map(f => (
                  <div key={f.id} className="bg-white p-3 rounded-xl shadow-sm flex justify-between border-l-4 border-gray-200">
                    <div>
                      <p className="text-sm font-bold">{f.nome}</p>
                      <p className="text-[10px]">{f.tipo_produto}</p>
                    </div>
                    <Phone size={16} className="text-gray-300" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ABA: NOVA MEDIDA (O código que já tínhamos) */}
        {abaAtiva === 'nova' && (
          <div className="text-center">
            {/* Aqui entra todo aquele formulário de cortinas/papéis que você já tem */}
            <p className="text-sm text-gray-500 mb-4">Formulário de Medição Ativo</p>
            {/* ... (Inserir aqui a lógica de cadastro que você já validou) ... */}
            <button onClick={() => setAbaAtiva('home')} className="text-xs text-[#d4af37] underline">Voltar ao Menu</button>
          </div>
        )}
      </main>

      {/* MENU DE NAVEGAÇÃO FIXO */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-100 p-4 flex justify-around rounded-t-[30px] shadow-2xl">
        <button onClick={() => setAbaAtiva('home')} className={`flex flex-col items-center ${abaAtiva === 'home' ? 'text-[#d4af37]' : 'text-gray-300'}`}>
          <Home size={24} /> <span className="text-[10px]">Início</span>
        </button>
        <button onClick={() => setAbaAtiva('nova')} className={`flex flex-col items-center ${abaAtiva === 'nova' ? 'text-[#d4af37]' : 'text-gray-300'}`}>
          <Plus size={24} /> <span className="text-[10px]">Medir</span>
        </button>
        <button onClick={() => setAbaAtiva('historico')} className={`flex flex-col items-center ${abaAtiva === 'historico' ? 'text-[#d4af37]' : 'text-gray-300'}`}>
          <BookOpen size={24} /> <span className="text-[10px]">Histórico</span>
        </button>
        <button onClick={() => setAbaAtiva('contatos')} className={`flex flex-col items-center ${abaAtiva === 'contatos' ? 'text-[#d4af37]' : 'text-gray-300'}`}>
          <Users size={24} /> <span className="text-[10px]">Contatos</span>
        </button>
      </nav>
    </div>
  );
}