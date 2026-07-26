import React from 'react';
import { UndoableInput } from './UndoableFields';

const formatButtonClass = (active) => (
  `flex-1 px-3 py-2 text-xs rounded border transition ${
    active
      ? 'bg-jwtBlue text-white border-jwtBlue'
      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
  }`
);

const ImageOutputControls = ({
  outputFormat,
  pngScale,
  setOutputFormat,
  setPngScale,
}) => (
  <>
    <div>
      <label className="label">Output Format</label>
      <div className="mt-1 flex gap-2">
        <button
          onClick={() => setOutputFormat('png')}
          className={formatButtonClass(outputFormat === 'png')}
        >
          PNG
        </button>
        <button
          onClick={() => setOutputFormat('svg')}
          className={formatButtonClass(outputFormat === 'svg')}
        >
          SVG
        </button>
      </div>
    </div>

    {outputFormat === 'png' && (
      <div>
        <label className="label">PNG Scale: {pngScale}x</label>
        <UndoableInput
          type="range"
          min="1"
          max="5"
          step="1"
          value={pngScale}
          onChange={(event) => setPngScale(Number(event.target.value))}
          className="mt-1 w-full"
        />
        <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1">
          {[1, 2, 3, 4, 5].map((scale) => <span key={scale}>{scale}x</span>)}
        </div>
      </div>
    )}
  </>
);

export default ImageOutputControls;
