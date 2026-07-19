import React from 'react';
import Shell from '../../src/control/Shell';
import RadarPanel from '../../src/control/RadarPanel';

export default function PeopleRadar() {
  return (
    <Shell title="People Radar">
      <RadarPanel kind="people" />
    </Shell>
  );
}
