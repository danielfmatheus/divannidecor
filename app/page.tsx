"use client"
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Camera, FileText, Plus, Trash2, Home, User, Ruler, 
  Search, Users, BookOpen, LogOut, Loader2, Send, CheckCircle, Phone, ArrowLeft
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Configuração do Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function DivanniApp() {
  // --- ESTADOS DE SISTEMA ---
  const [user, setUser] = useState<any>(null);
  const [abaAtiva, setAbaAtiva] = useState<'home' | 'nova' | 'historico' | 'contatos'>('home');
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // --- ESTADOS DE DADOS ---
  const [clienteNome, setClienteNome] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  const [contatos, setContatos] = useState<{clientes: any[], fornecedores: any[]}>({clientes: [], fornecedores: []});
  const [statusSalvar, setStatusSalvar] = useState<'idle' | 'salvando' | 'sucesso'>('idle');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const ambientes = ["Sala", "Quarto Casal", "Quarto Visitas", "Escritório", "Varanda", "Cozinha", "Lavabo", "Closet", "Sala de Jantar"];

  // --- CONTROLE DE SESSÃO ---
  useEffect(() => {
    // Verifica se já existe um usuário logado
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Escuta mudanças no login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) carregarDadosIniciais();
    });

    return () => subscription.unsubscribe();
  }, []);

  const carregarDadosIniciais = async () => {
    const { data: med } = await supabase.from('medicoes').select('*, clientes(*)').order('criado_at', { ascending: false });
    const { data: cli } = await supabase.from('clientes').select('*').order('nome_cliente');
    const { data: forn } = await supabase.from('fornecedores').select('*').order('nome');
    if (med) setHistorico(med);
    if (cli || forn) setContatos({ clientes: cli || [], fornecedores: forn || [] });
  };

  // --- FUNÇÕES DE AUTH ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Erro: " + error.message);
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAbaAtiva('home');
  };

  // --- LÓGICA DE MEDIÇÃO ---
  const adicionarItem = (tipo: 'cortina' | 'papel' | 'persiana') => {
    const novoItem = {
      id: Date.now(),
      categoria: tipo,
      ambiente: 'Sala',
      observacao: '',
      fotos: [],
      dados: tipo === 'cortina' ? {
        fixacao: 'Trilho', local: 'Teto', sanca: 'Não', largura: '', alt_dir: '', alt_meio: '', alt_esq: ''
      } : tipo === 'papel' ? {
        largura: '', altura: '', desc_largura: '', desc_altura: ''
      } : {
        fixacao: 'Lado a Lado', local: 'Teto', sanca: 'Não', tipo_p: 'Rolô', largura_sup: '', largura_inf: '', altura: ''
      }
    };
    setItens([...itens, novoItem]);
  };

  const atualizarItem = (id: number, campo: string, valor: string) => {
    setItens(itens.map(item => {
      if (item.id === id) {
        if (campo.includes('.')) {
          const [obj, key] = campo.split('.');
          return { ...item, [obj]: { ...item[obj], [key]: valor } };
        }
        return { ...item, [campo]: valor };
      }
      return item;
    }));
  };

  const handleFoto = async (itemId: number, e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);
    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('fotos-medidas').upload(fileName, file);
    if (!error) {
      const { data: urlData } = supabase.storage.from('fotos-medidas').getPublicUrl(fileName);
      setItens(itens.map(item => item.id === itemId ? { ...item, fotos: [...item.fotos, urlData.publicUrl] } : item ));
    }
    setUploadingPhoto(false);
  };

  const salvarTudo = async () => {
    if (!clienteNome) return alert("Digite o nome do cliente");
    setStatusSalvar('salvando');
    
    const { data: cliData, error: cliErr } = await supabase.from('clientes').insert([{ nome_cliente: clienteNome }]).select().single();
    if (cliErr) return setStatusSalvar('idle');

    const medicoes = itens.map(item => ({
      cliente_id: cliData.id,
      ambiente: item.ambiente,
      categoria: item.categoria,
      dados: item.dados,
      fotos: item.fotos,
      observacao: item.observacao
    }));

    const { error: medErr } = await supabase.from('medicoes').insert(medicoes);
    if (medErr) alert("Erro ao salvar medições");
    else {
      setStatusSalvar('sucesso');
      setTimeout(() => { setStatusSalvar('idle'); setAbaAtiva('home'); setItens([]); setClienteNome(''); carregarDadosIniciais(); }, 2000);
    }
  };

  // --- PDF ---
  const gerarPDF = () => {
    const doc = new jsPDF();
    doc.text(`DIVANNIDECOR - Cliente: ${clienteNome}`, 14, 20);
    itens.forEach((item, i) => {
      const y = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 30;
      autoTable(doc, {
        startY: y,
        head: [[`${item.categoria.toUpperCase()} - ${item.ambiente}`, 'VALOR']],
        body: Object.entries(item.dados).map(([k,v]) => [k.toUpperCase(), String(v)]),
        theme: 'grid'
      });
    });
    doc.save(`Medida_${clienteNome}.pdf`);
  };

  // --- TELAS ---

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#001f3f] text-white"><Loader2 className="animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#001f3f] flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <Ruler size={48} className="mx-auto text-[#d4af37] mb-2" />
            <h1 className="text-2xl font-serif tracking-[0.2em] text-[#001f3f]">DIVANNIDECOR</h1>
            <p className="text-gray-400 text-[10px] uppercase tracking-widest">Acesso Administrativo</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="E-mail" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border focus:border-[#d4af37]" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border focus:border-[#d4af37]" value={password} onChange={e => setPassword(e.target.value)} required />
            <button disabled={authLoading} className="w-full bg-[#001f3f] text-[#d4af37] p-4 rounded-2xl font-bold uppercase flex justify-center shadow-lg">
              {authLoading ? <Loader2 className="animate-spin" /> : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <header className="bg-[#001f3f] text-white p-6 rounded-b-[40px] flex justify-between items-center border-b-4 border-[#d4af37] shadow-xl">
        <div>
          <h1 className="text-lg font-serif tracking-widest text-[#d4af37]">DIVANNIDECOR</h1>
          <p className="text-[10px] opacity-60 uppercase">{abaAtiva === 'home' ? 'Painel Principal' : abaAtiva}</p>
        </div>
        <button onClick={handleLogout} className="p-2 opacity-50"><LogOut size={20} /></button>
      </header>

      <main className="p-4">
        {/* ABA: HOME */}
        {abaAtiva === 'home' && (
          <div className="grid grid-cols-2 gap-4 pt-4">
            <button onClick={() => setAbaAtiva('nova')} className="bg-white p-8 rounded-[30px] shadow-sm flex flex-col items-center gap-3 border border-gray-100">
              <div className="bg-blue-50 p-4 rounded-full text-[#d4af37]"><Plus /></div>
              <span className="text-xs font-bold text-[#001f3f] uppercase">Nova Medida</span>
            </button>
            <button onClick={() => setAbaAtiva('historico')} className="bg-white p-8 rounded-[30px] shadow-sm flex flex-col items-center gap-3 border border-gray-100">
              <div className="bg-gold-50 p-4 rounded-full text-[#d4af37]"><Search /></div>
              <span className="text-xs font-bold text-[#001f3f] uppercase">Histórico</span>
            </button>
            <button onClick={() => setAbaAtiva('contatos')} className="bg-white p-8 rounded-[30px] shadow-sm flex flex-col items-center gap-3 border border-gray-100 col-span-2">
              <div className="bg-gray-50 p-4 rounded-full text-[#d4af37]"><Users /></div>
              <span className="text-xs font-bold text-[#001f3f] uppercase">Clientes e Fornecedores</span>
            </button>
          </div>
        )}

        {/* ABA: NOVA MEDIDA */}
        {abaAtiva === 'nova' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm">
              <User className="text-[#d4af37]" />
              <input className="w-full outline-none font-bold" placeholder="NOME DO CLIENTE" value={clienteNome} onChange={e => setClienteNome(e.target.value)} />
            </div>

            {itens.map((item, idx) => (
              <div key={item.id} className="bg-white rounded-3xl p-6 shadow-md border-t-8 border-[#d4af37] relative">
                <button onClick={() => setItens(itens.filter(i => i.id !== item.id))} className="absolute top-4 right-4 text-red-300"><Trash2 size={18} /></button>
                
                <div className="flex items-center gap-2 mb-6 font-bold text-[#001f3f] uppercase text-sm border-b pb-2">
                  <select className="bg-transparent" value={item.ambiente} onChange={e => atualizarItem(item.id, 'ambiente', e.target.value)}>
                    {ambientes.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <span>- {item.categoria}</span>
                </div>

                {item.categoria === 'cortina' && (
                  <div className="grid grid-cols-2 gap-4">
                    <select className="border-b p-2" onChange={e => atualizarItem(item.id, 'dados.fixacao', e.target.value)}><option>Trilho</option><option>Varão</option></select>
                    <select className="border-b p-2" onChange={e => atualizarItem(item.id, 'dados.local', e.target.value)}><option>Teto</option><option>Parede</option></select>
                    <input placeholder="Largura" className="border-b p-2 col-span-2" type="number" onChange={e => atualizarItem(item.id, 'dados.largura', e.target.value)} />
                    <div className="col-span-2 grid grid-cols-3 gap-2">
                      <input placeholder="Alt Esq" className="border p-2 rounded" type="number" onChange={e => atualizarItem(item.id, 'dados.alt_esq', e.target.value)} />
                      <input placeholder="Alt Meio" className="border p-2 rounded" type="number" onChange={e => atualizarItem(item.id, 'dados.alt_meio', e.target.value)} />
                      <input placeholder="Alt Dir" className="border p-2 rounded" type="number" onChange={e => atualizarItem(item.id, 'dados.alt_dir', e.target.value)} />
                    </div>
                  </div>
                )}

                {item.categoria === 'papel' && (
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Altura" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.altura', e.target.value)} />
                    <input placeholder="Largura" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.largura', e.target.value)} />
                    <p className="col-span-2 text-[10px] text-gray-400 font-bold uppercase">Descontos</p>
                    <input placeholder="Desc. Alt" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.desc_altura', e.target.value)} />
                    <input placeholder="Desc. Larg" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.desc_largura', e.target.value)} />
                  </div>
                )}

                {item.categoria === 'persiana' && (
                  <div className="grid grid-cols-2 gap-4">
                    <select className="border-b p-2" onChange={e => atualizarItem(item.id, 'dados.fixacao', e.target.value)}><option>Lado a Lado</option><option>Transpasse</option></select>
                    <input placeholder="Altura" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.altura', e.target.value)} />
                    <input placeholder="Larg Sup" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.largura_sup', e.target.value)} />
                    <input placeholder="Larg Inf" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.largura_inf', e.target.value)} />
                  </div>
                )}

                <textarea placeholder="Observações..." className="w-full mt-4 bg-gray-50 p-3 rounded-xl text-sm" onChange={e => atualizarItem(item.id, 'observacao', e.target.value)} />
                
                <div className="mt-4 flex items-center gap-3">
                   <label className="bg-[#001f3f] text-white p-3 rounded-xl flex items-center gap-2 cursor-pointer">
                    <Camera size={18} className="text-[#d4af37]" />
                    <span className="text-xs font-bold">{uploadingPhoto ? '...' : 'FOTO'}</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFoto(item.id, e)} />
                   </label>
                   {item.fotos.map((url:any, i:number) => (
                     <img key={i} src={url} className="w-12 h-12 object-cover rounded-lg border border-[#d4af37]" />
                   ))}
                </div>
              </div>
            ))}
            
            <div className="flex gap-2">
              <button onClick={salvarTudo} disabled={statusSalvar === 'salvando'} className="flex-1 bg-[#001f3f] text-white p-4 rounded-2xl font-bold flex justify-center gap-2">
                {statusSalvar === 'salvando' ? <Loader2 className="animate-spin" /> : <Send className="text-[#d4af37]" />}
                {statusSalvar === 'salvando' ? 'SALVANDO...' : 'SALVAR NO SISTEMA'}
              </button>
              <button onClick={gerarPDF} className="bg-[#d4af37] text-[#001f3f] p-4 rounded-2xl font-bold"><FileText /></button>
            </div>
          </div>
        )}

        {/* ABA: HISTÓRICO */}
        {abaAtiva === 'historico' && (
          <div className="space-y-3">
             <div className="flex items-center gap-2 mb-4" onClick={() => setAbaAtiva('home')}><ArrowLeft size={18}/> <span className="font-bold">Voltar</span></div>
             {historico.map(h => (
               <div key={h.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center border-l-4 border-[#d4af37]">
                 <div>
                   <p className="font-bold text-[#001f3f]">{h.clientes?.nome_cliente}</p>
                   <p className="text-[10px] text-gray-400">{h.ambiente} - {new Date(h.criado_at).toLocaleDateString()}</p>
                 </div>
                 <button onClick={() => { setClienteNome(h.clientes?.nome_cliente); setItens([h]); gerarPDF(); }} className="p-2 bg-gray-50 rounded-full text-[#d4af37]"><FileText size={20}/></button>
               </div>
             ))}
          </div>
        )}

        {/* ABA: CONTATOS */}
        {abaAtiva === 'contatos' && (
          <div className="space-y-6">
             <div className="flex items-center gap-2 mb-4" onClick={() => setAbaAtiva('home')}><ArrowLeft size={18}/> <span className="font-bold">Voltar</span></div>
             <section>
               <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-2">Clientes Recentes</h3>
               <div className="grid grid-cols-1 gap-2">
                 {contatos.clientes.map(c => (
                   <div key={c.id} className="bg-white p-4 rounded-2xl flex justify-between items-center">
                     <span className="font-medium">{c.nome_cliente}</span>
                     <Phone size={16} className="text-gray-300" />
                   </div>
                 ))}
               </div>
             </section>
          </div>
        )}
      </main>

      {/* Menu Inferior */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-100 p-4 flex justify-around rounded-t-[35px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <button onClick={() => setAbaAtiva('home')} className={`flex flex-col items-center ${abaAtiva === 'home' ? 'text-[#d4af37]' : 'text-gray-300'}`}>
          <Home size={22} /> <span className="text-[10px] font-bold mt-1">Início</span>
        </button>
        <div className="flex gap-2 bg-gray-50 p-1 rounded-2xl">
          <button onClick={() => { adicionarItem('cortina'); setAbaAtiva('nova'); }} className="p-2 text-[#001f3f]"><Plus size={20}/><span className="text-[8px] block">Cortina</span></button>
          <button onClick={() => { adicionarItem('papel'); setAbaAtiva('nova'); }} className="p-2 text-[#001f3f]"><Plus size={20}/><span className="text-[8px] block">Papel</span></button>
          <button onClick={() => { adicionarItem('persiana'); setAbaAtiva('nova'); }} className="p-2 text-[#001f3f]"><Plus size={20}/><span className="text-[8px] block">Persiana</span></button>
        </div>
        <button onClick={() => setAbaAtiva('historico')} className={`flex flex-col items-center ${abaAtiva === 'historico' ? 'text-[#d4af37]' : 'text-gray-300'}`}>
          <Search size={22} /> <span className="text-[10px] font-bold mt-1">Busca</span>
        </button>
      </nav>
    </div>
  );
}