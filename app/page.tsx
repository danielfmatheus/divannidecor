"use client"
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Camera, FileText, Plus, Trash2, Home, User, Ruler, CheckCircle, Send, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function DivanniApp() {
  const [cliente, setCliente] = useState('');
  const [itens, setItens] = useState<any[]>([]);
  const [status, setStatus] = useState<'idle' | 'salvando' | 'sucesso'>('idle');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const ambientes = ["Sala", "Quarto Casal", "Quarto Visitas", "Escritório", "Varanda", "Cozinha", "Lavabo", "Closet", "Sala de Jantar"];

  // --- LÓGICA DE NEGÓCIO ---

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
      } : { // persiana
        fixacao: 'Lado a Lado', local: 'Teto', sanca: 'Não', tipo_p: 'Rolô', tipo_outro: '',
        largura_total: '', largura_sup: '', largura_meio: '', largura_inf: '', altura: ''
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

  // --- PERSISTÊNCIA (SUPABASE) ---

  const salvarNoBanco = async () => {
    if (!cliente) return alert("Digite o nome do cliente");
    if (itens.length === 0) return alert("Adicione pelo menos um item");

    setStatus('salvando');
    
    // 1. Criar/Pegar Cliente
    const { data: clienteData, error: cliError } = await supabase
      .from('clientes')
      .insert([{ nome_cliente: cliente }])
      .select()
      .single();

    if (cliError) {
      alert("Erro ao salvar cliente");
      setStatus('idle');
      return;
    }

    // 2. Salvar Medições
    const medicoesParaSalvar = itens.map(item => ({
      cliente_id: clienteData.id,
      ambiente: item.ambiente,
      categoria: item.categoria,
      dados: item.dados,
      fotos: item.fotos,
      observacao: item.observacao
    }));

    const { error: medError } = await supabase.from('medicoes').insert(medicoesParaSalvar);

    if (medError) {
      alert("Erro ao salvar medições");
    } else {
      setStatus('sucesso');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  const handleFoto = async (itemId: number, e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPhoto(true);

    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('fotos-medidas').upload(fileName, file);

    if (!error) {
      const { data: urlData } = supabase.storage.from('fotos-medidas').getPublicUrl(fileName);
      setItens(itens.map(item => 
        item.id === itemId ? { ...item, fotos: [...item.fotos, urlData.publicUrl] } : item
      ));
    }
    setUploadingPhoto(false);
  };

  // --- PDF ---

  const gerarPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.setTextColor(0, 31, 63); 
    doc.text("DIVANNIDECOR", 14, 20);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`RELATÓRIO TÉCNICO DE MEDIÇÃO`, 14, 28);
    doc.text(`CLIENTE: ${cliente.toUpperCase()}`, 14, 35);
    doc.text(`DATA: ${new Date().toLocaleDateString()}`, 14, 40);

    itens.forEach((item, index) => {
      const lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 45;
      
      const rows: any[][] = Object.entries(item.dados).map(([key, value]) => [
        key.replace('_', ' ').toUpperCase(), String(value)
      ]);
      
      if (item.categoria === 'papel') {
        const area = (Number(item.dados.largura) * Number(item.dados.altura)) - (Number(item.dados.desc_largura) * Number(item.dados.desc_altura));
        rows.push(['ÁREA LÍQUIDA', area.toFixed(2) + ' m²']);
      }

      rows.push(['OBSERVAÇÃO', item.observacao]);

      // @ts-ignore
      autoTable(doc, {
        startY: lastY + 10,
        head: [[`${item.categoria.toUpperCase()} - ${item.ambiente}`, 'VALORES']],
        body: rows,
        headStyles: { fillColor: [0, 31, 63], textColor: [212, 175, 55] },
        theme: 'grid'
      });
    });

    doc.save(`Medidas_${cliente}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] pb-40">
      {/* Header Luxo */}
      <header className="bg-[#001f3f] text-white p-8 shadow-2xl rounded-b-[40px] border-b-4 border-[#d4af37]">
        <div className="flex flex-col items-center gap-2">
          <div className="bg-[#d4af37] p-3 rounded-full mb-2">
            <Ruler size={32} className="text-[#001f3f]" />
          </div>
          <h1 className="text-2xl font-serif tracking-[0.2em] text-[#d4af37]">DIVANNIDECOR</h1>
          <p className="text-[10px] opacity-60 tracking-widest uppercase">Sistemas de Medição Premium</p>
        </div>
        
        <div className="mt-8 relative">
          <input 
            className="w-full p-4 pl-12 rounded-2xl text-black shadow-inner border-none focus:ring-2 focus:ring-[#d4af37]" 
            placeholder="Nome Completo do Cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          />
          <User className="absolute left-4 top-4 text-gray-400" size={20} />
        </div>
      </header>

      <main className="p-4 space-y-6 -mt-4">
        {itens.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p>Nenhuma medição adicionada.</p>
            <p className="text-xs">Use os botões abaixo para começar.</p>
          </div>
        )}

        {itens.map((item) => (
          <div key={item.id} className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-gray-50 px-6 py-3 flex justify-between items-center border-b">
              <div className="flex items-center gap-2 text-[#001f3f] font-bold italic">
                <Home size={18} className="text-[#d4af37]" />
                <select 
                  className="bg-transparent outline-none focus:text-[#d4af37]"
                  value={item.ambiente}
                  onChange={(e) => atualizarItem(item.id, 'ambiente', e.target.value)}
                >
                  {ambientes.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <button onClick={() => setItens(itens.filter(i => i.id !== item.id))} className="text-red-400 hover:text-red-600">
                <Trash2 size={18} />
              </button>
            </div>

            <div className="p-6">
              {/* Formulários Específicos com Metragem Automática para Papel */}
              {item.categoria === 'cortina' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Fixação</label>
                    <select className="w-full border-b-2 p-2 outline-none" onChange={(e) => atualizarItem(item.id, 'dados.fixacao', e.target.value)}>
                      <option>Trilho</option><option>Varão</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Teto/Parede</label>
                    <select className="w-full border-b-2 p-2 outline-none" onChange={(e) => atualizarItem(item.id, 'dados.local', e.target.value)}>
                      <option>Teto</option><option>Parede</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Largura (m)</label>
                    <input type="number" step="0.01" className="w-full border-b-2 p-2 text-lg" placeholder="0.00" onChange={(e) => atualizarItem(item.id, 'dados.largura', e.target.value)} />
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-2 bg-gray-50 p-3 rounded-xl">
                    <input placeholder="Esq" type="number" className="bg-transparent border-b w-full p-1" onChange={(e) => atualizarItem(item.id, 'dados.alt_esq', e.target.value)} />
                    <input placeholder="Meio" type="number" className="bg-transparent border-b w-full p-1" onChange={(e) => atualizarItem(item.id, 'dados.alt_meio', e.target.value)} />
                    <input placeholder="Dir" type="number" className="bg-transparent border-b w-full p-1" onChange={(e) => atualizarItem(item.id, 'dados.alt_dir', e.target.value)} />
                  </div>
                </div>
              )}

              {item.categoria === 'papel' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <input placeholder="Altura Parede" type="number" className="border-b-2 p-2" onChange={(e) => atualizarItem(item.id, 'dados.altura', e.target.value)} />
                    <input placeholder="Largura Parede" type="number" className="border-b-2 p-2" onChange={(e) => atualizarItem(item.id, 'dados.largura', e.target.value)} />
                  </div>
                  <div className="bg-red-50 p-3 rounded-xl grid grid-cols-2 gap-4">
                    <p className="col-span-2 text-[10px] text-red-400 font-bold uppercase">Descontos</p>
                    <input placeholder="Alt. Janela" type="number" className="bg-transparent border-b border-red-200 p-1" onChange={(e) => atualizarItem(item.id, 'dados.desc_altura', e.target.value)} />
                    <input placeholder="Larg. Janela" type="number" className="bg-transparent border-b border-red-200 p-1" onChange={(e) => atualizarItem(item.id, 'dados.desc_largura', e.target.value)} />
                  </div>
                  {item.dados.largura && item.dados.altura && (
                    <div className="text-right text-[#001f3f] font-bold">
                      Área Líquida: {((item.dados.largura * item.dados.altura) - (item.dados.desc_largura * item.dados.desc_altura)).toFixed(2)} m²
                    </div>
                  )}
                </div>
              )}

              {item.categoria === 'persiana' && (
                <div className="grid grid-cols-2 gap-4">
                  <select className="col-span-1 border-b-2 p-2" onChange={(e) => atualizarItem(item.id, 'dados.tipo_p', e.target.value)}>
                    <option>Rolô</option><option>Romana</option><option>Outra</option>
                  </select>
                  <input placeholder="Altura" type="number" className="border-b-2 p-2" onChange={(e) => atualizarItem(item.id, 'dados.altura', e.target.value)} />
                  <input placeholder="Larg. Superior" type="number" className="border-b-2 p-2" onChange={(e) => atualizarItem(item.id, 'dados.largura_sup', e.target.value)} />
                  <input placeholder="Larg. Inferior" type="number" className="border-b-2 p-2" onChange={(e) => atualizarItem(item.id, 'dados.largura_inf', e.target.value)} />
                </div>
              )}

              <textarea 
                className="w-full mt-6 bg-gray-50 p-4 rounded-2xl text-sm outline-none focus:ring-1 focus:ring-[#d4af37]" 
                placeholder="Observações especiais sobre este ambiente..." 
                onChange={(e) => atualizarItem(item.id, 'observacao', e.target.value)}
              />

              <div className="mt-6 flex flex-wrap gap-3">
                <label className="bg-[#001f3f] text-white px-4 py-3 rounded-2xl flex items-center gap-2 cursor-pointer active:scale-95 transition shadow-lg">
                  <Camera size={20} className="text-[#d4af37]" />
                  <span className="text-xs font-bold uppercase">{uploadingPhoto ? 'Enviando...' : 'Anexar Foto'}</span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleFoto(item.id, e)} />
                </label>
                
                <div className="flex gap-2 overflow-x-auto">
                  {item.fotos.map((url: string, i: number) => (
                    <img key={i} src={url} className="w-14 h-14 object-cover rounded-xl border-2 border-[#d4af37]" alt="Foto" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* Navegação Inferior de Controle */}
      <footer className="fixed bottom-0 w-full bg-white border-t border-gray-200 px-6 py-4 rounded-t-[40px] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => adicionarItem('cortina')} className="flex flex-col items-center">
            <div className="bg-gray-100 p-3 rounded-2xl mb-1 text-[#001f3f]"><Plus size={24} /></div>
            <span className="text-[10px] font-bold">Cortina</span>
          </button>
          <button onClick={() => adicionarItem('papel')} className="flex flex-col items-center">
            <div className="bg-gray-100 p-3 rounded-2xl mb-1 text-[#001f3f]"><Plus size={24} /></div>
            <span className="text-[10px] font-bold">Papel</span>
          </button>
          <button onClick={() => adicionarItem('persiana')} className="flex flex-col items-center">
            <div className="bg-gray-100 p-3 rounded-2xl mb-1 text-[#001f3f]"><Plus size={24} /></div>
            <span className="text-[10px] font-bold">Persiana</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={salvarNoBanco}
            disabled={status === 'salvando'}
            className={`flex items-center justify-center gap-2 p-4 rounded-2xl font-bold uppercase text-xs transition shadow-lg ${status === 'sucesso' ? 'bg-green-500 text-white' : 'bg-[#001f3f] text-white'}`}
          >
            {status === 'salvando' ? <Loader2 className="animate-spin" /> : status === 'sucesso' ? <CheckCircle /> : <Send size={18} className="text-[#d4af37]" />}
            {status === 'salvando' ? 'Salvando...' : status === 'sucesso' ? 'Salvo!' : 'Salvar Sistema'}
          </button>
          <button 
            onClick={gerarPDF}
            className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-[#d4af37] text-[#001f3f] font-bold uppercase text-xs shadow-lg"
          >
            <FileText size={18} />
            Gerar PDF
          </button>
        </div>
      </footer>
    </div>
  );
}