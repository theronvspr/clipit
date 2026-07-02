import React from 'react';
import { useAppState } from '../state/AppContext';
import { formatTime } from '../utils/format';
import './TrimReadout.css';

export const TrimReadout: React.FC = () => {
  const { state } = useAppState();

  const { inPoint, outPoint } = state;
  const selectionDuration = Math.max(0, outPoint - inPoint);

  return (
    <div className="trim-readout">
      <div className="item">
        <span className="label">In</span>
        <span className="value">{formatTime(inPoint)}</span>
      </div>
      <div className="item">
        <span className="label">Out</span>
        <span className="value">{formatTime(outPoint)}</span>
      </div>
      <div className="item">
        <span className="label">Selection</span>
        <span className="value">{formatTime(selectionDuration)}</span>
      </div>
    </div>
  );
};

export default TrimReadout;
