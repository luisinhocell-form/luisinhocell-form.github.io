// script.js
function loadScript(src){
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

function enablePdfMode() {
  const preview = document.getElementById('preview');
  preview.classList.add('pdf-mode');
  preview.style.transform = 'none';
}

function disablePdfMode() {
  const preview = document.getElementById('preview');
  preview.classList.remove('pdf-mode');
  scalePreview();
}

(function () {

  function scalePreview() {
    const preview = document.getElementById('preview');
    const wrapper = document.querySelector('.preview-wrapper');
  
    if (!preview || !wrapper) return;
  
    const wrapperWidth = wrapper.clientWidth;
    const previewWidth = preview.offsetWidth; // 794px fixo do A4

    const scale = wrapperWidth / previewWidth;
  
    // nunca aumenta acima de 1 (100%)
    preview.style.transform = scale < 1 ? `scale(${scale})` : 'scale(1)';

    wrapper.style.height = `${preview.offsetHeight * scale}px`;

  }

  window.addEventListener('load', scalePreview);
  window.addEventListener('resize', scalePreview);

  // adiciona item
  document.getElementById('addItem').addEventListener('click', () => {
    const descEl = document.getElementById('desc');
    const precoEl = document.getElementById('preco');
    const qtdEl = document.getElementById('qtd');

    const desc = descEl.value.trim();
    const preco = parseFloat(precoEl.value || 0);
    const qtd = parseInt(qtdEl.value || 1, 10);

    if (!desc) { alert('Preencha a descrição'); return; }
    if (!isFinite(preco) || preco < 0) { alert('Preencha um preço válido'); return; }
    if (!Number.isInteger(qtd) || qtd <= 0) { alert('Preencha uma quantidade válida'); return; }

    const tbody = document.querySelector('#itensTable tbody');
    const tr = document.createElement('tr');
    tr.dataset.desc = desc;
    tr.dataset.preco = String(preco);
    tr.dataset.qtd = String(qtd);

    tr.innerHTML = `<td>${desc}</td><td>${preco.toFixed(2)}</td><td>${qtd}</td>`;

    // Faz a linha inteira clicável para remover
    tr.addEventListener('click', () => {
      if (confirm(`Deseja remover "${desc}"?`)) {
        tr.remove();
        updatePreview();
      }
    });

    tbody.appendChild(tr);
    updatePreview();

    // limpa inputs
    descEl.value = '';
    precoEl.value = '';
    qtdEl.value = '1';
  });

  // atualiza preview
  function updatePreview(){
    const cliente = document.getElementById('cliente').value || '';
    const aparelho = document.getElementById('aparelho').value || '';
    const data = document.getElementById('data').value || '';
    const maoVal = Number(document.getElementById('mao').value || 0);
    const obs = document.getElementById('obs').value || '';
    const pagamento = document.getElementById('pag').value || '';
    const prazo = document.getElementById('')

    // atualiza campos textuais (verifique IDs no HTML)
    const pCliente = document.getElementById('pCliente');
    const pAparelho = document.getElementById('pAparelho');
    const pData = document.getElementById('pData');
    const pMao = document.getElementById('pMao');
    const pObs = document.getElementById('pObs');
    const pTotal = document.getElementById('pTotal');
    const pPagamento = document.getElementById('pPagamento');

    if (pCliente) pCliente.textContent = cliente;
    if (pAparelho) pAparelho.textContent = aparelho;
    if (pData) pData.textContent = data;
    if (pMao) pMao.textContent = maoVal.toFixed(2);
    if (pObs) pObs.textContent = obs;
    if (pPagamento) pPagamento.textContent = pagamento;

    // monta tabela de itens (e calcula total)
    const tbody = document.querySelector('#previewTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let total = 0;
    document.querySelectorAll('#itensTable tbody tr').forEach(tr => {
      const desc = tr.dataset.desc || '';
      const preco = parseFloat(tr.dataset.preco) || 0;
      const qtd = parseInt(tr.dataset.qtd, 10) || 0;
      const subtotal = preco * qtd;
      total += subtotal;

      const row = document.createElement('tr');
      row.innerHTML = `<td>${desc}</td><td>${preco.toFixed(2)}</td><td>${qtd}</td><td>${subtotal.toFixed(2)}</td>`;
      tbody.appendChild(row);
    });

    const totalGeral = total + maoVal;
    if (pTotal) pTotal.textContent = totalGeral.toFixed(2);
  }

  // tenta transformar o logo em dataURL (evita taint). Se falhar, oculta o logo.
  async function inlineLogoOrHide() {
    const img = document.getElementById('logoPreview');
    if (!img || !img.src) return;
    try {
      // tenta buscar a imagem e convertê-la em dataURL
      const resp = await fetch(img.src, { mode: 'cors' });
      if (!resp.ok) throw new Error('fetch não ok');
      const blob = await resp.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });
      img.src = dataUrl;
      img.style.display = ''; // garante visível
    } catch (e) {
      // não pôde inlinear (provável CORS) — melhor ocultar para evitar o canvas tainted
      console.warn('Não foi possível inlinear o logo (CORS). O logo será ocultado para gerar o PDF.', e);
      img.style.display = 'none';
    }
  }

  // gerar PDF
  document.getElementById('gerar').addEventListener('click', async () => {
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

      // atualiza preview e garante que o logo não tainta o canvas
      updatePreview();
      await inlineLogoOrHide();
      enablePdfMode();

      const preview = document.getElementById('preview');

      // html2canvas: useCORS permite tentar imagens com crossOrigin, mas só funciona se o servidor permitir
      const canvas = await html2canvas(preview, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');

      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const imgProps = pdf.getImageProperties(imgData);
      const pdfW = pageWidth - 40;
      const pdfH = (imgProps.height * pdfW) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 20, 20, pdfW, pdfH);
      pdf.save('orcamento_luisinhocell.pdf');

      disablePdfMode();

      // se ocultamos o logo, opcionalmente restaurar a visualização (descomente caso queira)
      // const logo = document.getElementById('logoPreview');
      // if (logo && logo.dataset.originalSrc) { logo.src = logo.dataset.originalSrc; logo.style.display = ''; }

    } catch (err) {
      console.error(err);
      alert('Erro ao gerar PDF. Veja o console para mais detalhes.');
    }
  });

  // DOMContentLoaded tasks
  document.addEventListener('DOMContentLoaded', () => {
    const dataInput = document.getElementById('data');
    if (dataInput) {
      const hoje = new Date();
      const dia = String(hoje.getDate()).padStart(2,'0');
      const mes = String(hoje.getMonth()+1).padStart(2,'0');
      const ano = hoje.getFullYear();
      dataInput.value = `${dia}/${mes}/${ano}`;
    }

    // liga inputs para atualizar preview
    ['cliente','aparelho','data','mao','obs'].forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updatePreview);
    });

    updatePreview(); // atualização inicial
  });

  // se o script for carregado depois do DOM (normal no seu caso), garante um update
  updatePreview();

})();
