"use client"
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Camera, FileText, Plus, Trash2, Home, User, Ruler, 
  Search, Users, BookOpen, LogOut, Loader2, Send, CheckCircle, Phone, ArrowLeft,
  MapPin, Mail, CreditCard, ChevronRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Inicia Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function DivanniApp() {
  const [user, setUser] = useState<any>(null);
  const [abaAtiva, setAbaAtiva] = useState<'home' | 'nova' | 'historico' | 'contatos'>('home');
  const [loading, setLoading] = useState(true);
  
  // Estados do Formulário
  const [clienteNome, setClienteNome] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [contatosLista, setContatosLista] = useState<any[]>([]);
  
  // Login
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Status de Salvamento
  const [status, setStatus] = useState<'idle' | 'processando' | 'erro'>('idle');

  const ambientes = ["Sala", "Quarto Casal", "Quarto", "Escritório", "Varanda", "Cozinha", "Lavabo", "Closet"];

  // --- CARREGAMENTO INICIAL ---
  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) carregarDados();
    });
    return () => subscription.unsubscribe();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    if (session) carregarDados();
    setLoading(false);
  }

  async function carregarDados() {
    const { data: med } = await supabase.from('medicoes').select('*, clientes(*)').order('criado_at', { ascending: false });
    const { data: cont } = await supabase.from('contatos').select('*').order('nome');
    if (med) setHistorico(med);
    if (cont) setContatosLista(cont);
  }

  // --- FUNÇÕES DE SALVAMENTO (COM ALERTAS) ---

  const salvarMedicao = async () => {
    console.log("Iniciando salvamento...");
    if (!clienteNome) return alert("⚠️ Erro: Digite o nome do cliente antes de salvar!");
    if (itens.length === 0) return alert("⚠️ Erro: Adicione pelo menos uma medida (Cortina, Papel ou Persiana).");

    setStatus('processando');

    try {
      // 1. Criar Cliente
      const { data: cli, error: errCli } = await supabase.from('clientes').insert([{ nome_cliente: clienteNome }]).select().single();
      if (errCli) throw errCli;

      // 2. Criar Medidas
      const medsParaSalvar = itens.map(item => ({
        cliente_id: cli.id,
        ambiente: item.ambiente,
        categoria: item.categoria,
        dados: item.dados,
        fotos: item.fotos,
        observacao: item.observacao
      }));

      const { error: errMed } = await supabase.from('medicoes').insert(medsParaSalvar);
      if (errMed) throw errMed;

      alert("✅ Sucesso! Medidas salvas no sistema.");
      setItens([]);
      setClienteNome('');
      setAbaAtiva('home');
      carregarDados();
    } catch (error: any) {
      alert("❌ ERRO AO SALVAR: " + error.message);
    } finally {
      setStatus('idle');
    }
  };

  const salvarContato = async (novoContato: any) => {
    if (!novoContato.nome) return alert("⚠️ Digite o nome do contato.");
    setStatus('processando');
    const { error } = await supabase.from('contatos').insert([novoContato]);
    if (error) alert("❌ Erro ao salvar contato: " + error.message);
    else {
      alert("✅ Contato adicionado!");
      carregarDados();
    }
    setStatus('idle');
  };

  // --- COMPONENTES DE INTERFACE ---

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#001f3f] text-white">Carregando DivanniDecor...</div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#001f3f] flex items-center justify-center p-6 text-white font-sans">
        <div className="bg-white text-[#001f3f] w-full max-w-md p-8 rounded-[40px] shadow-2xl">
          <h1 className="text-2xl font-bold text-center mb-6 tracking-tighter italic">DIVANNIDECOR</h1>
          <div className="space-y-4">
            <input type="email" placeholder="E-mail" className="w-full p-4 border rounded-2xl" onChange={e => setEmail(e.target.value)} />
            <input type="password" placeholder="Senha" className="w-full p-4 border rounded-2xl" onChange={e => setPassword(e.target.value)} />
            <button 
              onClick={async () => {
                setAuthLoading(true);
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) alert("Erro de login: " + error.message);
                setAuthLoading(false);
              }}
              className="w-full bg-[#001f3f] text-[#d4af37] p-4 rounded-2xl font-bold uppercase"
            >
              {authLoading ? "Acessando..." : "Entrar no Sistema"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-40 font-sans">
      {/* Header Fixo */}
      <header className="bg-[#001f3f] text-white p-6 rounded-b-[40px] flex justify-between items-center shadow-xl border-b-4 border-[#d4af37]">
        <div>
          <h1 className="text-xl font-bold italic tracking-tighter">DIVANNIDECOR</h1>
          <p className="text-[10px] text-[#d4af37] font-bold uppercase tracking-widest">{abaAtiva}</p>
        </div>
        <button onClick={() => supabase.auth.signOut()} className="bg-white/10 p-2 rounded-full"><LogOut size={18} /></button>
      </header>

      <main className="p-4 pt-6">
        {/* TELA INICIAL (MENU) */}
        {abaAtiva === 'home' && (
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setAbaAtiva('nova')} className="bg-white p-10 rounded-[40px] shadow-sm border flex flex-col items-center gap-3">
              <div className="bg-[#001f3f] p-4 rounded-full text-[#d4af37] shadow-lg"><Plus /></div>
              <span className="font-bold text-[#001f3f] text-xs uppercase">Nova Medida</span>
            </button>
            <button onClick={() => setAbaAtiva('historico')} className="bg-white p-10 rounded-[40px] shadow-sm border flex flex-col items-center gap-3">
              <div className="bg-[#d4af37] p-4 rounded-full text-[#001f3f] shadow-lg"><Search /></div>
              <span className="font-bold text-[#001f3f] text-xs uppercase">Histórico</span>
            </button>
            <button onClick={() => setAbaAtiva('contatos')} className="bg-white p-10 rounded-[40px] shadow-sm border flex flex-col items-center gap-3 col-span-2">
              <div className="bg-gray-100 p-4 rounded-full text-[#001f3f] shadow-sm"><Users /></div>
              <span className="font-bold text-[#001f3f] text-xs uppercase">Agenda de Contatos</span>
            </button>
          </div>
        )}

        {/* TELA DE NOVA MEDIDA */}
        {abaAtiva === 'nova' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Nome do Cliente</label>
              <input 
                className="w-full text-xl font-bold outline-none text-[#001f3f] mt-1" 
                placeholder="Ex: João da Silva"
                value={clienteNome}
                onChange={e => setClienteNome(e.target.value)}
              />
            </div>

            {itens.map((item, index) => (
              <div key={item.id} className="bg-white rounded-[40px] p-6 shadow-md border-t-[10px] border-[#d4af37] relative">
                <button onClick={() => setItens(itens.filter(i => i.id !== item.id))} className="absolute top-6 right-6 text-red-300"><Trash2 size={20}/></button>
                <h3 className="text-xs font-black uppercase text-[#001f3f] mb-4 flex items-center gap-2">
                  <Home size={14} className="text-[#d4af37]"/> 
                  <select 
                    className="bg-transparent"
                    value={item.ambiente}
                    onChange={e => {
                      const newItens = [...itens];
                      newItens[index].ambiente = e.target.value;
                      setItens(newItens);
                    }}
                  >
                    {ambientes.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                   | {item.categoria}
                </h3>

                {/* CAMPOS CORTINA */}
                {item.categoria === 'cortina' && (
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Largura" className="col-span-2 border-b-2 p-2 text-lg" type="number" onChange={e => item.dados.largura = e.target.value} />
                    <input placeholder="Alt Esq" className="border-b p-2" type="number" onChange={e => item.dados.alt_esq = e.target.value} />
                    <input placeholder="Alt Dir" className="border-b p-2" type="number" onChange={e => item.dados.alt_dir = e.target.value} />
                  </div>
                )}

                {/* CAMPOS PAPEL */}
                {item.categoria === 'papel' && (
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Alt Parede" className="border-b p-2" type="number" onChange={e => item.dados.altura = e.target.value} />
                    <input placeholder="Larg Parede" className="border-b p-2" type="number" onChange={e => item.dados.largura = e.target.value} />
                  </div>
                )}

                {/* CAMPOS PERSIANA */}
                {item.categoria === 'persiana' && (
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Largura" className="border-b p-2" type="number" onChange={e => item.dados.largura = e.target.value} />
                    <input placeholder="Altura" className="border-b p-2" type="number" onChange={e => item.dados.altura = e.target.value} />
                  </div>
                )}

                <textarea 
                  className="w-full mt-4 bg-gray-50 p-4 rounded-2xl text-sm" 
                  placeholder="Observações..."
                  onChange={e => item.observacao = e.target.value}
                />
              </div>
            ))}

            <div className="fixed bottom-6 left-4 right-4 flex gap-3">
              <button 
                onClick={salvarMedicao}
                disabled={status === 'processando'}
                className="flex-1 bg-[#001f3f] text-[#d4af37] p-5 rounded-[25px] font-black uppercase text-sm shadow-2xl flex justify-center items-center gap-2"
              >
                {status === 'processando' ? <Loader2 className="animate-spin"/> : <CheckCircle size={20}/>}
                SALVAR NO SISTEMA
              </button>
            </div>
          </div>
        )}

        {/* TELA DE HISTÓRICO */}
        {abaAtiva === 'historico' && (
          <div className="space-y-3">
            <button onClick={() => setAbaAtiva('home')} className="font-bold flex items-center gap-2 mb-4 text-[#001f3f] uppercase text-xs"><ArrowLeft size={16}/> Voltar</button>
            {historico.map(h => (
              <div key={h.id} className="bg-white p-5 rounded-[30px] shadow-sm flex justify-between items-center border-l-8 border-[#d4af37]">
                <div>
                  <p className="font-bold text-[#001f3f] uppercase text-sm">{h.clientes?.nome_cliente}</p>
                  <p className="text-[10px] text-gray-400 font-bold">{h.ambiente} • {new Date(h.criado_at).toLocaleDateString()}</p>
                </div>
                <button className="bg-gray-100 p-3 rounded-full text-[#001f3f]"><FileText size={20}/></button>
              </div>
            ))}
          </div>
        )}

        {/* TELA DE CONTATOS */}
        {abaAtiva === 'contatos' && (
          <div className="space-y-4 pb-20">
            <button onClick={() => setAbaAtiva('home')} className="font-bold flex items-center gap-2 mb-2 text-[#001f3f] uppercase text-xs"><ArrowLeft size={16}/> Voltar</button>
            
            {/* Formulário Simples Contato */}
            <div className="bg-white p-6 rounded-[30px] border-2 border-[#d4af37] shadow-lg">
              <h4 className="text-[10px] font-black uppercase mb-4 tracking-widest">Novo Contato</h4>
              <div className="space-y-3">
                <input id="cnome" placeholder="Nome" className="w-full border-b p-2 text-sm" />
                <input id="ctelefone" placeholder="Telefone" className="w-full border-b p-2 text-sm" />
                <select id="ctipo" className="w-full border-b p-2 text-sm bg-transparent font-bold">
                  <option>Cliente</option><option>Arquiteto</option><option>Fornecedor</option>
                </select>
                <button 
                  onClick={() => {
                    const nome = (document.getElementById('cnome') as HTMLInputElement).value;
                    const tel = (document.getElementById('ctelefone') as HTMLInputElement).value;
                    const tipo = (document.getElementById('ctipo') as HTMLSelectElement).value;
                    salvarContato({ nome, telefone: tel, tipo });
                  }}
                  className="w-full bg-[#001f3f] text-[#d4af37] p-4 rounded-2xl font-bold uppercase text-xs"
                >
                  Salvar Contato
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {contatosLista.map(c => (
                <div key={c.id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-bold text-[#001f3f]">{c.nome}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase">{c.tipo} | {c.telefone}</p>
                  </div>
                  <Phone size={16} className="text-[#d4af37]" />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Navegação Inferior */}
      {abaAtiva !== 'nova' && (
        <nav className="fixed bottom-0 w-full bg-white border-t p-6 flex justify-around rounded-t-[50px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <button onClick={() => setAbaAtiva('home')} className={abaAtiva === 'home' ? 'text-[#d4af37]' : 'text-gray-300'}><Home size={28}/></button>
          <div className="flex gap-4">
             <button onClick={() => { setAbaAtiva('nova'); setItens([{id: Date.now(), categoria: 'cortina', ambiente: 'Sala', dados: {}, fotos: [], observacao: ''}]); }} className="bg-[#001f3f] text-[#d4af37] p-3 rounded-2xl font-black text-[10px]">CORTINA</button>
             <button onClick={() => { setAbaAtiva('nova'); setItens([{id: Date.now(), categoria: 'papel', ambiente: 'Sala', dados: {}, fotos: [], observacao: ''}]); }} className="bg-[#001f3f] text-[#d4af37] p-3 rounded-2xl font-black text-[10px]">PAPEL</button>
          </div>
          <button onClick={() => setAbaAtiva('historico')} className={abaAtiva === 'historico' ? 'text-[#d4af37]' : 'text-gray-300'}><BookOpen size={28}/></button>
        </nav>
      )}
    </div>
  );
}