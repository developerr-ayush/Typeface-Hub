'use client';

import { useState } from 'react';
import { Tabs } from '../ui';
import { GoogleTab } from './google-tab';
import { StylesheetTab } from './stylesheet-tab';
import { UploadTab } from './upload-tab';

type Tab = 'upload' | 'google' | 'css';

export function AddFontTabs(props: {
  ws: string;
  workspaceId: string;
  uploadMode: 'blob' | 'direct';
  googleMode: 'external' | 'import';
  selfHostOnly: boolean;
  initialTab: Tab;
}) {
  const [tab, setTab] = useState<Tab>(props.initialTab);
  return (
    <div>
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(t) => {
          setTab(t);
          history.replaceState(null, '', `?tab=${t}`);
        }}
        tabs={[
          { id: 'upload', label: 'Upload files' },
          { id: 'google', label: 'Google Fonts' },
          { id: 'css', label: 'Stylesheet & legacy import' },
        ]}
      />
      {tab === 'upload' && <UploadTab ws={props.ws} workspaceId={props.workspaceId} mode={props.uploadMode} />}
      {tab === 'google' && <GoogleTab ws={props.ws} defaultMode={props.googleMode} selfHostOnly={props.selfHostOnly} />}
      {tab === 'css' && <StylesheetTab ws={props.ws} selfHostOnly={props.selfHostOnly} />}
    </div>
  );
}
