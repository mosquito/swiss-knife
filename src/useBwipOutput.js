import { useRef, useState } from 'react';
import bwipjs from 'bwip-js';
import { useDebouncedEffect, useStoredState } from './hooks';
import {
  copyCanvasImage,
  downloadUrl,
  shareUrl,
} from './browserActions';

const rawStringOptions = {
  parse: (value) => value,
  stringify: String,
  validate: (value) => value === 'svg' || value === 'png',
};

const pngScaleOptions = {
  parse: Number,
  stringify: String,
  validate: (value) => Number.isFinite(value) && value >= 1 && value <= 5,
};

const renderCanvas = (canvas, options) => {
  const context = canvas.getContext('2d');
  context.save();
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();
  bwipjs.toCanvas(canvas, options);
};

const scaledCanvasDataUrl = (canvas, scale) => {
  if (scale <= 1) return canvas.toDataURL('image/png');
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = canvas.width * scale;
  scaledCanvas.height = canvas.height * scale;
  const context = scaledCanvas.getContext('2d');
  context.imageSmoothingEnabled = false;
  context.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
  return scaledCanvas.toDataURL('image/png');
};

export const useBwipOutput = ({
  storagePrefix,
  createOptions,
  dependencies,
  fileBaseName,
  shareTitle,
  onRendered,
  renderErrorMessage = 'Failed to render',
  debounce = 250,
}) => {
  const [outputFormat, setOutputFormat] = useStoredState(
    `${storagePrefix}_output_format`,
    'svg',
    rawStringOptions,
  );
  const [pngScale, setPngScale] = useStoredState(
    `${storagePrefix}_png_scale`,
    1,
    pngScaleOptions,
  );
  const [imgUrl, setImgUrl] = useState('');
  const [imageKey, setImageKey] = useState(0);
  const [error, setError] = useState('');
  const canvasRef = useRef(null);
  const createOptionsRef = useRef(createOptions);
  const fileBaseNameRef = useRef(fileBaseName);
  const onRenderedRef = useRef(onRendered);

  createOptionsRef.current = createOptions;
  fileBaseNameRef.current = fileBaseName;
  onRenderedRef.current = onRendered;

  const render = () => {
    try {
      const options = createOptionsRef.current();
      let url;
      if (outputFormat === 'svg') {
        url = 'data:image/svg+xml,' + encodeURIComponent(bwipjs.toSVG(options));
      } else {
        const canvas = canvasRef.current;
        if (!canvas) return;
        renderCanvas(canvas, options);
        url = scaledCanvasDataUrl(canvas, pngScale);
      }
      setImgUrl(url);
      setImageKey((key) => key + 1);
      setError('');
      onRenderedRef.current?.();
    } catch (renderError) {
      setError(renderError.message || renderErrorMessage);
      setImgUrl('');
    }
  };

  useDebouncedEffect(
    render,
    debounce,
    [...dependencies, outputFormat, pngScale],
  );

  const download = () => {
    const extension = outputFormat === 'svg' ? 'svg' : 'png';
    return downloadUrl(imgUrl, `${fileBaseNameRef.current()}.${extension}`);
  };

  const copyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    try {
      renderCanvas(canvas, createOptionsRef.current());
      return await copyCanvasImage(canvas);
    } catch {
      return false;
    }
  };

  const share = () => shareUrl({ title: shareTitle });

  return {
    canvasRef,
    copyImage,
    download,
    error,
    imageKey,
    imgUrl,
    outputFormat,
    pngScale,
    setOutputFormat,
    setPngScale,
    share,
  };
};
