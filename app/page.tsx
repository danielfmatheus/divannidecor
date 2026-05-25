"use client"
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Camera, FileText, Plus, Trash2, Home, User, Ruler, 
  Search, Users, BookOpen, LogOut, Loader2, Send, CheckCircle, Phone, ArrowLeft,
  MapPin, Mail, CreditCard, Briefcase, ChevronRight
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

  // --- ESTADOS DE MEDIÇÃO ---
  const [clienteNome, setClienteNome] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  
  // --- ESTADOS DE CONTATOS ---
  const [contatosLista, setContatosLista] = useState<any[]>([]);
  const [exibirFormContato, setExibirFormContato] = useState(false);
  const [novoContato, setNovoContato] = useState({
    nome: '', telefone: '', endereco: '', cpf_cnpj: '', email: '', tipo: 'Cliente'
  });

  const [statusSalvar, setStatusSalvar] = useState<'idle' | 'salvando' | 'sucesso'>('idle');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const ambientes = ["Sala", "Quarto Casal", "Quarto Visitas", "Escritório", "Varanda", "Cozinha", "Lavabo", "Closet", "Sala de Jantar"];

  // --- CONTROLE DE SESSÃO E CARREGAMENTO ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session) carregarDadosIniciais();
    });

    return () => subscription.unsubscribe();
  }, []);

  const carregarDadosIniciais = async () => {
    const { data: med } = await supabase.from('medicoes').select('*, clientes(*)').order('criado_at', { ascending: false });
    const { data: cont } = await supabase.from('contatos').select('*').order('nome');
    if (med) setHistorico(med);
    if (cont) setContatosLista(cont);
  };

  // --- FUNÇÕES DE LOGIN ---
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
  };

  // --- FUNÇÕES DE CONTATOS ---
  const salvarContato = async () => {
    if (!novoContato.nome) return alert("Nome é obrigatório");
    setStatusSalvar('salvando');
    const { error } = await supabase.from('contatos').insert([{ ...novoContato, usuario_id: user.id }]);
    if (error) alert("Erro ao salvar: " + error.message);
    else {
      setStatusSalvar('sucesso');
      setNovoContato({ nome: '', telefone: '', endereco: '', cpf_cnpj: '', email: '', tipo: 'Cliente' });
      setExibirFormContato(false);
      carregarDadosIniciais();
      setTimeout(() => setStatusSalvar('idle'), 2000);
    }
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
        fixacao: 'Lado a Lado', local: 'Teto', sanca: 'Não', tipo_p: 'Rolô', tipo_outro: '', largura_total: '', largura_sup: '', largura_meio: '', largura_inf: '', altura: ''
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

  const salvarMedicaoCompleta = async () => {
    if (!clienteNome) return alert("Digite o nome do cliente");
    if (itens.length === 0) return alert("Adicione ao menos uma medida");
    setStatusSalvar('salvando');
    
    const { data: cliData, error: cliErr } = await supabase.from('clientes').insert([{ nome_cliente: clienteNome }]).select().single();
    if (cliErr) return setStatusSalvar('idle');

    const meds = itens.map(item => ({
      cliente_id: cliData.id,
      ambiente: item.ambiente,
      categoria: item.categoria,
      dados: item.dados,
      fotos: item.fotos,
      observacao: item.observacao
    }));

    await supabase.from('medicoes').insert(meds);
    setStatusSalvar('sucesso');
    setTimeout(() => {
      setStatusSalvar('idle');
      setAbaAtiva('home');
      setItens([]);
      setClienteNome('');
      carregarDadosIniciais();
    }, 2000);
  };

  const gerarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("DIVANNIDECOR - MEDIÇÕES", 14, 20);
    doc.setFontSize(12);
    doc.text(`Cliente: ${clienteNome}`, 14, 30);

    itens.forEach((item, i) => {
      const y = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 40;
      autoTable(doc, {
        startY: y,
        head: [[`${item.categoria.toUpperCase()} - ${item.ambiente}`, 'VALOR']],
        body: [...Object.entries(item.dados).map(([k,v]) => [k.toUpperCase().replace('_', ' '), String(v)]), ["OBS", item.observacao]],
        theme: 'striped',
        headStyles: { fillColor: [0, 31, 63] }
      });
    });
    doc.save(`Divanni_${clienteNome}.pdf`);
  };

  // --- TELAS ---

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#001f3f] text-white"><Loader2 className="animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#001f3f] flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <Ruler size={48} className="mx-auto text-[#d4af37] mb-2" />
            <h1 className="text-2xl font-serif tracking-widest text-[#001f3f]">DIVANNIDECOR</h1>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="E-mail" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Senha" className="w-full p-4 bg-gray-50 rounded-2xl outline-none border" value={password} onChange={e => setPassword(e.target.value)} required />
            <button className="w-full bg-[#001f3f] text-[#d4af37] p-4 rounded-2xl font-bold uppercase">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-[#001f3f] text-white p-6 rounded-b-[40px] flex justify-between items-center border-b-4 border-[#d4af37] shadow-xl">
        <h1 className="text-lg font-serif tracking-widest text-[#d4af37]">DIVANNIDECOR</h1>
        <button onClick={handleLogout} className="opacity-50"><LogOut size={20} /></button>
      </header>

      <main className="p-4">
        {/* HOME */}
        {abaAtiva === 'home' && (
          <div className="grid grid-cols-2 gap-4 pt-4">
            <button onClick={() => setAbaAtiva('nova')} className="bg-white p-8 rounded-[30px] shadow-sm flex flex-col items-center gap-3 border border-gray-100">
              <div className="bg-blue-50 p-4 rounded-full text-[#d4af37]"><Plus /></div>
              <span className="text-xs font-bold uppercase text-[#001f3f]">Nova Medida</span>
            </button>
            <button onClick={() => setAbaAtiva('historico')} className="bg-white p-8 rounded-[30px] shadow-sm flex flex-col items-center gap-3 border border-gray-100">
              <div className="bg-orange-50 p-4 rounded-full text-[#d4af37]"><Search /></div>
              <span className="text-xs font-bold uppercase text-[#001f3f]">Histórico</span>
            </button>
            <button onClick={() => setAbaAtiva('contatos')} className="bg-white p-8 rounded-[30px] shadow-sm flex flex-col items-center gap-3 border border-gray-100 col-span-2">
              <div className="bg-gray-50 p-4 rounded-full text-[#d4af37]"><Users /></div>
              <span className="text-xs font-bold uppercase text-[#001f3f]">Agenda de Parceiros</span>
            </button>
          </div>
        )}

        {/* CONTATOS */}
        {abaAtiva === 'contatos' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <button onClick={() => setAbaAtiva('home')} className="flex items-center gap-2 text-sm font-bold text-[#001f3f]"><ArrowLeft size={18}/> Voltar</button>
              <button onClick={() => setExibirFormContato(!exibirFormContato)} className="bg-[#001f3f] text-[#d4af37] px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2">
                <Plus size={14}/> NOVO
              </button>
            </div>

            {exibirFormContato && (
              <div className="bg-white p-6 rounded-3xl shadow-lg border-2 border-[#d4af37] space-y-4">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {['Cliente', 'Fornecedor', 'Arquiteto'].map(t => (
                    <button key={t} onClick={() => setNovoContato({...novoContato, tipo: t})} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase ${novoContato.tipo === t ? 'bg-[#d4af37] text-[#001f3f]' : 'bg-gray-100 text-gray-400'}`}>{t}</button>
                  ))}
                </div>
                <input placeholder="Nome" className="w-full border-b p-2 text-sm" value={novoContato.nome} onChange={e => setNovoContato({...novoContato, nome: e.target.value})} />
                <input placeholder="Telefone" className="w-full border-b p-2 text-sm" value={novoContato.telefone} onChange={e => setNovoContato({...novoContato, telefone: e.target.value})} />
                <input placeholder="Endereço" className="w-full border-b p-2 text-sm" value={novoContato.endereco} onChange={e => setNovoContato({...novoContato, endereco: e.target.value})} />
                <input placeholder="CPF/CNPJ" className="w-full border-b p-2 text-sm" value={novoContato.cpf_cnpj} onChange={e => setNovoContato({...novoContato, cpf_cnpj: e.target.value})} />
                <input placeholder="E-mail" className="w-full border-b p-2 text-sm" value={novoContato.email} onChange={e => setNovoContato({...novoContato, email: e.target.value})} />
                <button onClick={salvarContato} className="w-full bg-[#001f3f] text-white p-3 rounded-2xl font-bold text-xs uppercase flex justify-center gap-2">
                   {statusSalvar === 'salvando' ? <Loader2 className="animate-spin" /> : <CheckCircle size={16} className="text-[#d4af37]"/>} SALVAR
                </button>
              </div>
            )}

            {['Cliente', 'Arquiteto', 'Fornecedor'].map(tipo => (
              <div key={tipo} className="pt-2">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-widest px-2">{tipo}s</h3>
                <div className="space-y-2">
                  {contatosLista.filter(c => c.tipo === tipo).map(c => (
                    <div key={c.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center">
                      <div>
                        <p className="font-bold text-[#001f3f] text-sm">{c.nome}</p>
                        <p className="text-[10px] text-gray-400">{c.telefone} | {c.email}</p>
                      </div>
                      <Phone size={16} className="text-gray-200" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* NOVA MEDIDA */}
        {abaAtiva === 'nova' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-3">
              <User className="text-[#d4af37]" />
              <input className="w-full outline-none font-bold text-[#001f3f]" placeholder="NOME DO CLIENTE" value={clienteNome} onChange={e => setClienteNome(e.target.value)} />
            </div>

            {itens.map((item) => (
              <div key={item.id} className="bg-white rounded-[30px] p-6 shadow-md border-t-8 border-[#d4af37] relative">
                <button onClick={() => setItens(itens.filter(i => i.id !== item.id))} className="absolute top-4 right-4 text-red-300"><Trash2 size={18} /></button>
                
                <div className="flex items-center gap-2 mb-6 font-bold text-[#001f3f] uppercase text-xs border-b pb-2">
                  <Home size={14} className="text-[#d4af37]" />
                  <select className="bg-transparent" value={item.ambiente} onChange={e => atualizarItem(item.id, 'ambiente', e.target.value)}>
                    {ambientes.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <span>- {item.categoria}</span>
                </div>

                {item.categoria === 'cortina' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-1"><label className="text-[9px] uppercase text-gray-400">Fixação</label>
                      <select className="w-full border-b p-1 text-sm" onChange={e => atualizarItem(item.id, 'dados.fixacao', e.target.value)}><option>Trilho</option><option>Varão</option></select>
                    </div>
                    <div className="col-span-1"><label className="text-[9px] uppercase text-gray-400">Teto/Parede</label>
                      <select className="w-full border-b p-1 text-sm" onChange={e => atualizarItem(item.id, 'dados.local', e.target.value)}><option>Teto</option><option>Parede</option></select>
                    </div>
                    <div className="col-span-2"><label className="text-[9px] uppercase text-gray-400">Largura</label>
                      <input className="w-full border-b p-1 text-sm" type="number" placeholder="0.00" onChange={e => atualizarItem(item.id, 'dados.largura', e.target.value)} />
                    </div>
                    <div className="col-span-2 grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded-xl">
                      <input placeholder="Esq" className="w-full border-b p-1 text-center text-sm" type="number" onChange={e => atualizarItem(item.id, 'dados.alt_esq', e.target.value)} />
                      <input placeholder="Meio" className="w-full border-b p-1 text-center text-sm" type="number" onChange={e => atualizarItem(item.id, 'dados.alt_meio', e.target.value)} />
                      <input placeholder="Dir" className="w-full border-b p-1 text-center text-sm" type="number" onChange={e => atualizarItem(item.id, 'dados.alt_dir', e.target.value)} />
                    </div>
                  </div>
                )}

                {item.categoria === 'papel' && (
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Altura Parede" className="border-b p-2 text-sm" type="number" onChange={e => atualizarItem(item.id, 'dados.altura', e.target.value)} />
                    <input placeholder="Largura Parede" className="border-b p-2 text-sm" type="number" onChange={e => atualizarItem(item.id, 'dados.largura', e.target.value)} />
                    <p className="col-span-2 text-[9px] text-red-400 font-bold uppercase mt-2">Descontos (Vãos)</p>
                    <input placeholder="Altura Vão" className="border-b p-2 text-sm" type="number" onChange={e => atualizarItem(item.id, 'dados.desc_altura', e.target.value)} />
                    <input placeholder="Largura Vão" className="border-b p-2 text-sm" type="number" onChange={e => atualizarItem(item.id, 'dados.desc_largura', e.target.value)} />
                  </div>
                )}

                {item.categoria === 'persiana' && (
                  <div className="grid grid-cols-2 gap-4">
                    <select className="col-span-2 border-b p-2 text-sm" onChange={e => atualizarItem(item.id, 'dados.fixacao', e.target.value)}><option>Lado a Lado</option><option>Transpasse</option></select>
                    <input placeholder="Altura" className="border-b p-2 text-sm" type="number" onChange={e => atualizarItem(item.id, 'dados.altura', e.target.value)} />
                    <input placeholder="Larg. Sup" className="border-b p-2 text-sm" type="number" onChange={e => atualizarItem(item.id, 'dados.largura_sup', e.target.value)} />
                    <input placeholder="Larg. Meio" className="border-b p-2 text-sm" type="number" onChange={e => atualizarItem(item.id, 'dados.largura_meio', e.target.value)} />
                    <input placeholder="Larg. Inf" className="border-b p-2 text-sm" type="number" onChange={e => atualizarItem(item.id, 'dados.largura_inf', e.target.value)} />
                  </div>
                )}

                <textarea placeholder="Observações importantes..." className="w-full mt-4 bg-gray-50 p-3 rounded-2xl text-xs" onChange={e => atualizarItem(item.id, 'observacao', e.target.value)} />
                
                <div className="mt-4 flex items-center gap-3">
                   <label className="bg-[#001f3f] text-white p-3 rounded-2xl flex items-center gap-2 cursor-pointer shadow-md active:scale-95 transition">
                    <Camera size={18} className="text-[#d4af37]" />
                    <span className="text-[10px] font-bold uppercase">{uploadingPhoto ? '...' : 'FOTO'}</span>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFoto(item.id, e)} />
                   </label>
                   <div className="flex gap-2 overflow-x-auto">
                    {item.fotos.map((url:any, i:number) => (
                      <img key={i} src={url} className="w-12 h-12 object-cover rounded-xl border-2 border-[#d4af37]" />
                    ))}
                   </div>
                </div>
              </div>
            ))}
            
            <div className="flex gap-3">
              <button onClick={salvarMedicaoCompleta} disabled={statusSalvar === 'salvando'} className="flex-1 bg-[#001f3f] text-white p-5 rounded-[25px] font-bold text-xs uppercase flex justify-center gap-3 shadow-xl">
                {statusSalvar === 'salvando' ? <Loader2 className="animate-spin text-[#d4af37]" /> : <Send size={16} className="text-[#d4af37]" />}
                {statusSalvar === 'salvando' ? 'SALVANDO...' : 'SALVAR NO SISTEMA'}
              </button>
              <button onClick={gerarPDF} className="bg-[#d4af37] text-[#001f3f] p-5 rounded-[25px] font-bold shadow-xl"><FileText size={20}/></button>
            </div>
          </div>
        )}

        {/* HISTÓRICO */}
        {abaAtiva === 'historico' && (
          <div className="space-y-3">
            <button onClick={() => setAbaAtiva('home')} className="flex items-center gap-2 text-sm font-bold text-[#001f3f] mb-4"><ArrowLeft size={18}/> Voltar</button>
            {historico.map(h => (
              <div key={h.id} className="bg-white p-5 rounded-[25px] shadow-sm flex justify-between items-center border-l-4 border-[#d4af37]">
                <div>
                  <p className="font-bold text-[#001f3f] text-sm uppercase">{h.clientes?.nome_cliente}</p>
                  <p className="text-[10px] text-gray-400">{h.ambiente} • {new Date(h.criado_at).toLocaleDateString()}</p>
                </div>
                <button onClick={() => { setClienteNome(h.clientes?.nome_cliente); setItens([h]); gerarPDF(); }} className="p-3 bg-gray-50 rounded-full text-[#d4af37]"><FileText size={20}/></button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Navegação Inferior */}
      <nav className="fixed bottom-0 w-full bg-white border-t p-4 flex justify-around rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
        <button onClick={() => setAbaAtiva('home')} className={`flex flex-col items-center gap-1 ${abaAtiva === 'home' ? 'text-[#d4af37]' : 'text-gray-300'}`}>
          <Home size={22} /> <span className="text-[9px] font-bold uppercase tracking-tighter">Início</span>
        </button>
        <div className="flex gap-2 bg-gray-50 p-1 rounded-2xl">
          <button onClick={() => { setAbaAtiva('nova'); adicionarItem('cortina'); }} className="p-2 text-[#001f3f] flex flex-col items-center"><Plus size={16}/><span className="text-[7px] font-bold uppercase">Cortina</span></button>
          <button onClick={() => { setAbaAtiva('nova'); adicionarItem('papel'); }} className="p-2 text-[#001f3f] flex flex-col items-center"><Plus size={16}/><span className="text-[7px] font-bold uppercase">Papel</span></button>
          <button onClick={() => { setAbaAtiva('nova'); adicionarItem('persiana'); }} className="p-2 text-[#001f3f] flex flex-col items-center"><Plus size={16}/><span className="text-[7px] font-bold uppercase">Persiana</span></button>
        </div>
        <button onClick={() => setAbaAtiva('historico')} className={`flex flex-col items-center gap-1 ${abaAtiva === 'historico' ? 'text-[#d4af37]' : 'text-gray-300'}`}>
          <BookOpen size={22} /> <span className="text-[9px] font-bold uppercase tracking-tighter">Histórico</span>
        </button>
        <button onClick={() => setAbaAtiva('contatos')} className={`flex flex-col items-center gap-1 ${abaAtiva === 'contatos' ? 'text-[#d4af37]' : 'text-gray-300'}`}>
          <Users size={22} /> <span className="text-[9px] font-bold uppercase tracking-tighter">Agenda</span>
        </button>
      </nav>
    </div>
  );
}