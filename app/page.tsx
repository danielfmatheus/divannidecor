"use client"
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Camera, FileText, Plus, Trash2, Home, User, Ruler, 
  Search, Users, BookOpen, LogOut, Loader2, Send, CheckCircle, Phone, ArrowLeft,
  MapPin, Mail, CreditCard, Briefcase
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// CONFIGURAÇÃO DO SUPABASE
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function DivanniApp() {
  const [user, setUser] = useState<any>(null);
  const [abaAtiva, setAbaAtiva] = useState<'home' | 'nova' | 'historico' | 'contatos'>('home');
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Estados de Medição
  const [clienteNome, setClienteNome] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [historico, setHistorico] = useState<any[]>([]);
  
  // Estados de Contatos
  const [contatosLista, setContatosLista] = useState<any[]>([]);
  const [exibirFormContato, setExibirFormContato] = useState(false);
  const [novoContato, setNovoContato] = useState({
    nome: '', telefone: '', endereco: '', cpf_cnpj: '', email: '', tipo: 'Cliente'
  });

  const [statusSalvar, setStatusSalvar] = useState<'idle' | 'salvando' | 'sucesso'>('idle');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const ambientes = ["Sala", "Quarto Casal", "Quarto Visitas", "Escritório", "Varanda", "Cozinha", "Lavabo", "Closet", "Sala de Jantar"];

  // CONTROLE DE SESSÃO
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
    try {
      const { data: med } = await supabase.from('medicoes').select('*, clientes(*)').order('criado_at', { ascending: false });
      const { data: cont } = await supabase.from('contatos').select('*').order('nome');
      if (med) setHistorico(med);
      if (cont) setContatosLista(cont);
    } catch (e) { console.error("Erro ao carregar dados", e); }
  };

  // FUNÇÕES DE LOGIN
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("Erro no Login: " + error.message);
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // SALVAR CONTATO (AGENDA)
  const salvarContato = async () => {
    if (!novoContato.nome) return alert("Nome é obrigatório");
    setStatusSalvar('salvando');
    const { error } = await supabase.from('contatos').insert([{ ...novoContato, usuario_id: user.id }]);
    
    if (error) {
      alert("ERRO AO SALVAR CONTATO: " + error.message);
      setStatusSalvar('idle');
    } else {
      setStatusSalvar('sucesso');
      setNovoContato({ nome: '', telefone: '', endereco: '', cpf_cnpj: '', email: '', tipo: 'Cliente' });
      setExibirFormContato(false);
      carregarDadosIniciais();
      setTimeout(() => setStatusSalvar('idle'), 2000);
    }
  };

  // SALVAR MEDIÇÃO COMPLETA
  const salvarMedicaoCompleta = async () => {
    if (!clienteNome) return alert("Digite o nome do cliente");
    if (itens.length === 0) return alert("Adicione ao menos uma medida");
    setStatusSalvar('salvando');
    
    // 1. Cria o cliente
    const { data: cliData, error: cliErr } = await supabase.from('clientes').insert([{ nome_cliente: clienteNome }]).select().single();
    
    if (cliErr) {
      alert("ERRO AO CRIAR CLIENTE: " + cliErr.message);
      setStatusSalvar('idle');
      return;
    }

    // 2. Prepara as medidas
    const meds = itens.map(item => ({
      cliente_id: cliData.id,
      ambiente: item.ambiente,
      categoria: item.categoria,
      dados: item.dados,
      fotos: item.fotos,
      observacao: item.observacao
    }));

    const { error: medErr } = await supabase.from('medicoes').insert(meds);
    
    if (medErr) {
      alert("ERRO AO SALVAR MEDIDAS: " + medErr.message);
      setStatusSalvar('idle');
    } else {
      setStatusSalvar('sucesso');
      setTimeout(() => {
        setStatusSalvar('idle');
        setAbaAtiva('home');
        setItens([]);
        setClienteNome('');
        carregarDadosIniciais();
      }, 2000);
    }
  };

  // LÓGICA DE FORMULÁRIO DE MEDIDAS
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

  const gerarPDF = () => {
    const doc = new jsPDF();
    doc.text(`DIVANNIDECOR - Cliente: ${clienteNome}`, 14, 20);
    itens.forEach((item, i) => {
      const lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 30;
      autoTable(doc, {
        startY: lastY + 10,
        head: [[`${item.categoria.toUpperCase()} - ${item.ambiente}`, 'VALOR']],
        body: Object.entries(item.dados).map(([k,v]) => [k.toUpperCase(), String(v)]),
        theme: 'grid'
      });
    });
    doc.save(`Divanni_${clienteNome}.pdf`);
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#001f3f] text-white"><Loader2 className="animate-spin" /></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#001f3f] flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl">
          <h1 className="text-center text-xl font-bold mb-6 text-[#001f3f]">DIVANNIDECOR - LOGIN</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="email" placeholder="E-mail" className="w-full p-4 border rounded-2xl" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Senha" className="w-full p-4 border rounded-2xl" value={password} onChange={e => setPassword(e.target.value)} required />
            <button className="w-full bg-[#001f3f] text-white p-4 rounded-2xl font-bold">ENTRAR</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <header className="bg-[#001f3f] text-white p-6 rounded-b-[40px] flex justify-between items-center border-b-4 border-[#d4af37]">
        <h1 className="font-bold tracking-widest text-[#d4af37]">DIVANNIDECOR</h1>
        <button onClick={handleLogout} className="opacity-50"><LogOut size={20}/></button>
      </header>

      <main className="p-4">
        {abaAtiva === 'home' && (
          <div className="grid grid-cols-2 gap-4 pt-4">
            <button onClick={() => setAbaAtiva('nova')} className="bg-white p-8 rounded-[30px] shadow-sm flex flex-col items-center gap-2 border">
              <Plus className="text-[#d4af37]"/><span className="text-[10px] font-bold">NOVA MEDIDA</span>
            </button>
            <button onClick={() => setAbaAtiva('historico')} className="bg-white p-8 rounded-[30px] shadow-sm flex flex-col items-center gap-2 border">
              <Search className="text-[#d4af37]"/><span className="text-[10px] font-bold">HISTÓRICO</span>
            </button>
            <button onClick={() => setAbaAtiva('contatos')} className="bg-white p-8 rounded-[30px] shadow-sm flex flex-col items-center gap-2 border col-span-2">
              <Users className="text-[#d4af37]"/><span className="text-[10px] font-bold">AGENDA DE PARCEIROS</span>
            </button>
          </div>
        )}

        {abaAtiva === 'nova' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border shadow-sm">
              <input className="w-full font-bold outline-none" placeholder="NOME DO CLIENTE" value={clienteNome} onChange={e => setClienteNome(e.target.value)} />
            </div>

            {itens.map((item) => (
              <div key={item.id} className="bg-white p-6 rounded-[30px] border-t-8 border-[#d4af37] shadow-md relative">
                <button onClick={() => setItens(itens.filter(i => i.id !== item.id))} className="absolute top-4 right-4 text-red-400"><Trash2 size={18}/></button>
                <div className="font-bold text-xs uppercase mb-4 border-b pb-1">{item.ambiente} - {item.categoria}</div>
                
                {item.categoria === 'cortina' && (
                   <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Largura" className="col-span-2 border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.largura', e.target.value)} />
                      <input placeholder="Alt Esq" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.alt_esq', e.target.value)} />
                      <input placeholder="Alt Dir" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.alt_dir', e.target.value)} />
                   </div>
                )}

                {item.categoria === 'papel' && (
                   <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Altura" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.altura', e.target.value)} />
                      <input placeholder="Largura" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.largura', e.target.value)} />
                   </div>
                )}

                {item.categoria === 'persiana' && (
                   <div className="grid grid-cols-2 gap-3">
                      <input placeholder="Largura" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.largura_sup', e.target.value)} />
                      <input placeholder="Altura" className="border-b p-2" type="number" onChange={e => atualizarItem(item.id, 'dados.altura', e.target.value)} />
                   </div>
                )}

                <textarea placeholder="Observações" className="w-full mt-4 bg-gray-50 p-2 rounded-xl text-xs" onChange={e => atualizarItem(item.id, 'observacao', e.target.value)} />
                
                <div className="mt-4 flex gap-2 items-center">
                  <label className="bg-[#001f3f] text-white p-2 px-4 rounded-xl text-[10px] font-bold cursor-pointer">
                    {uploadingPhoto ? '...' : 'FOTO'}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFoto(item.id, e)} />
                  </label>
                  {item.fotos.map((url:any, i:number) => <img key={i} src={url} className="w-10 h-10 object-cover rounded-lg border border-[#d4af37]" />)}
                </div>
              </div>
            ))}

            <div className="flex gap-2">
              <button onClick={salvarMedicaoCompleta} className="flex-1 bg-[#001f3f] text-white p-4 rounded-2xl font-bold text-xs">
                {statusSalvar === 'salvando' ? 'SALVANDO...' : 'SALVAR NO SISTEMA'}
              </button>
              <button onClick={gerarPDF} className="bg-[#d4af37] p-4 rounded-2xl font-bold"><FileText/></button>
            </div>
          </div>
        )}

        {abaAtiva === 'contatos' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <button onClick={() => setAbaAtiva('home')} className="font-bold text-sm"><ArrowLeft size={18}/></button>
              <button onClick={() => setExibirFormContato(!exibirFormContato)} className="bg-[#001f3f] text-[#d4af37] px-4 py-2 rounded-full text-[10px] font-bold">NOVO CONTATO</button>
            </div>

            {exibirFormContato && (
              <div className="bg-white p-6 rounded-3xl border-2 border-[#d4af37] space-y-3">
                <div className="flex gap-2 mb-2">
                  {['Cliente', 'Arquiteto', 'Fornecedor'].map(t => (
                    <button key={t} onClick={() => setNovoContato({...novoContato, tipo: t})} className={`px-3 py-1 rounded-lg text-[10px] ${novoContato.tipo === t ? 'bg-[#d4af37]' : 'bg-gray-100'}`}>{t}</button>
                  ))}
                </div>
                <input placeholder="Nome" className="w-full border-b p-2" value={novoContato.nome} onChange={e => setNovoContato({...novoContato, nome: e.target.value})} />
                <input placeholder="Telefone" className="w-full border-b p-2" value={novoContato.telefone} onChange={e => setNovoContato({...novoContato, telefone: e.target.value})} />
                <input placeholder="Endereço" className="w-full border-b p-2" value={novoContato.endereco} onChange={e => setNovoContato({...novoContato, endereco: e.target.value})} />
                <button onClick={salvarContato} className="w-full bg-[#001f3f] text-white p-3 rounded-xl font-bold text-xs uppercase">SALVAR</button>
              </div>
            )}

            {contatosLista.map(c => (
              <div key={c.id} className="bg-white p-4 rounded-2xl border shadow-sm">
                <div className="font-bold text-sm">{c.nome} <span className="text-[9px] text-gray-400 font-normal uppercase">({c.tipo})</span></div>
                <div className="text-[10px] text-gray-500">{c.telefone} | {c.endereco}</div>
              </div>
            ))}
          </div>
        )}

        {abaAtiva === 'historico' && (
          <div className="space-y-2">
            <button onClick={() => setAbaAtiva('home')} className="font-bold mb-4"><ArrowLeft/></button>
            {historico.map(h => (
              <div key={h.id} className="bg-white p-4 rounded-2xl border flex justify-between items-center">
                <div className="font-bold text-xs uppercase">{h.clientes?.nome_cliente}</div>
                <button onClick={() => { setClienteNome(h.clientes?.nome_cliente); setItens([h]); gerarPDF(); }}><FileText className="text-[#d4af37]"/></button>
              </div>
            ))}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t p-4 flex justify-around rounded-t-[40px] shadow-2xl">
        <button onClick={() => setAbaAtiva('home')} className={abaAtiva === 'home' ? 'text-[#d4af37]' : 'text-gray-300'}><Home/></button>
        <button onClick={() => { setAbaAtiva('nova'); adicionarItem('cortina'); }} className="text-gray-300"><Plus/></button>
        <button onClick={() => setAbaAtiva('historico')} className={abaAtiva === 'historico' ? 'text-[#d4af37]' : 'text-gray-300'}><BookOpen/></button>
        <button onClick={() => setAbaAtiva('contatos')} className={abaAtiva === 'contatos' ? 'text-[#d4af37]' : 'text-gray-300'}><Users/></button>
      </nav>
    </div>
  );
}