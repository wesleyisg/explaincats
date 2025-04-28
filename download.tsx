// Criação de um novo arquivo para lidar com a lógica de download
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export async function downloadStoryAndImages(slideshow: HTMLDivElement) {
  const zip = new JSZip();
  const slides = slideshow.querySelectorAll('.slide');

  let roteiro = ''; // Variável para armazenar o roteiro completo

  const combinedFolder = zip.folder('combined'); // Pasta para imagens combinadas

  for (const [index, slide] of slides.entries()) {
    const img = slide.querySelector('img');
    const caption = slide.querySelector('div')?.textContent || '';

    if (img) {
      const imgData = img.src.split(',')[1]; // Remove o prefixo "data:image/png;base64,"
      zip.file(`image${index + 1}.png`, imgData, { base64: true });

      // Criar imagem combinada
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      const imageElement = new Image();
      imageElement.src = img.src;

      await new Promise((resolve) => {
        imageElement.onload = () => {
          const textHeight = 70; // Altura reservada para o texto aumentada
          canvas.width = imageElement.width;
          canvas.height = imageElement.height + textHeight;

          // Desenhar a imagem
          context.fillStyle = 'white';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(imageElement, 0, 0);

          // Adicionar o texto
          context.fillStyle = 'black';
          context.font = '24px Arial'; // Aumentar o tamanho da fonte
          context.textAlign = 'center';
          context.fillText(caption, canvas.width / 2, imageElement.height + textHeight / 2);

          // Adicionar ao ZIP
          canvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64Data = reader.result.split(',')[1];
              combinedFolder.file(`combined${index + 1}.png`, base64Data, { base64: true });
              resolve();
            };
            reader.readAsDataURL(blob);
          });
        };
      });
    }

    if (caption) {
      zip.file(`story${index + 1}.txt`, caption);
      roteiro += `${caption}\n\n`; // Adiciona a legenda ao roteiro completo
    }
  }

  // Adiciona o roteiro completo ao ZIP
  zip.file('roteiro.txt', roteiro);

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'story_and_images.zip');
}