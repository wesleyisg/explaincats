/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '@google/genai';
import {marked} from 'marked';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const ai = new GoogleGenAI({apiKey: process.env.API_KEY});

const chat = ai.chats.create({
  model: 'gemini-2.0-flash-exp',
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
  },
  history: [],
});

const userInput = document.querySelector('#input') as HTMLTextAreaElement;
const modelOutput = document.querySelector('#output') as HTMLDivElement;
const slideshow = document.querySelector('#slideshow') as HTMLDivElement;
const error = document.querySelector('#error') as HTMLDivElement;

const additionalInstructions = `
Use a fun story about lots of tiny cats as a metaphor.
Keep sentences short but conversational, casual, and engaging.
Generate a cute, minimal illustration for each sentence with black ink on white background.
No commentary, just begin your explanation.
Keep going until you're done.`;

async function addSlide(text: string, image: HTMLImageElement) {
  const slide = document.createElement('div');
  slide.className = 'slide';
  const caption = document.createElement('div') as HTMLDivElement;
  caption.innerHTML = await marked.parse(text);
  slide.append(image);
  slide.append(caption);
  slideshow.append(slide);
}

function parseError(error: string) {
  const regex = /{"error":(.*)}/gm;
  const m = regex.exec(error);
  try {
    const e = m[1];
    const err = JSON.parse(e);
    return err.message;
  } catch (e) {
    return error;
  }
}

async function generate(message: string) {
  userInput.disabled = true;

  chat.history.length = 0;
  modelOutput.innerHTML = '';
  slideshow.innerHTML = '';
  error.innerHTML = '';
  error.toggleAttribute('hidden', true);

  try {
    const userTurn = document.createElement('div') as HTMLDivElement;
    userTurn.innerHTML = await marked.parse(message);
    userTurn.className = 'user-turn';
    modelOutput.append(userTurn);
    userInput.value = '';

    const result = await chat.sendMessageStream({
      message: message + additionalInstructions,
    });

    let text = '';
    let img = null;

    for await (const chunk of result) {
      for (const candidate of chunk.candidates) {
        for (const part of candidate.content.parts ?? []) {
          if (part.text) {
            text += part.text;
          } else {
            try {
              const data = part.inlineData;
              if (data) {
                img = document.createElement('img');
                img.src = `data:image/png;base64,` + data.data;
              } else {
                console.log('no data', chunk);
              }
            } catch (e) {
              console.log('no data', chunk);
            }
          }
          if (text && img) {
            await addSlide(text, img);
            slideshow.removeAttribute('hidden');
            text = '';
            img = null;
          }
        }
      }
    }
    if (img) {
      await addSlide(text, img);
      slideshow.removeAttribute('hidden');
      text = '';
    }
  } catch (e) {
    const msg = parseError(e);
    error.innerHTML = `Something went wrong: ${msg}`;
    error.removeAttribute('hidden');
  }
  userInput.disabled = false;
  userInput.focus();
}

userInput.addEventListener('keydown', async (e: KeyboardEvent) => {
  if (e.code === 'Enter') {
    e.preventDefault();
    const message = userInput.value;
    await generate(message);
  }
});

const examples = document.querySelectorAll('#examples li');
examples.forEach((li) =>
  li.addEventListener('click', async (e) => {
    await generate(li.textContent);
  }),
);

const saveButton = document.createElement('button');
saveButton.textContent = 'Salvar História e Imagens';
saveButton.id = 'save-button';
document.body.appendChild(saveButton);

saveButton.addEventListener('click', async () => {
  const zip = new JSZip();
  const slides = slideshow.querySelectorAll('.slide');

  slides.forEach((slide, index) => {
    const img = slide.querySelector('img');
    const caption = slide.querySelector('div').textContent;

    if (img) {
      const imgData = img.src.split(',')[1]; // Remove o prefixo "data:image/png;base64,"
      zip.file(`image${index + 1}.png`, imgData, { base64: true });
    }

    if (caption) {
      zip.file(`story${index + 1}.txt`, caption);
    }
  });

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'story_and_images.zip');
});
