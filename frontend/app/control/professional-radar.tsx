import React from 'react';
import Shell from '../../src/control/Shell';
import RadarPanel from '../../src/control/RadarPanel';

export default function ProfessionalRadar() {
  return (
    <Shell title="Professional Radar">
      <RadarPanel kind="professional" />
    </Shell>
  );
}
