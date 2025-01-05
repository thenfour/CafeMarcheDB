// UnsavedChangesHandler.tsx
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { useRouter } from 'next/router';
import React, { useEffect, useRef, useState } from 'react';

interface UnsavedChangesHandlerProps {
  isDirty: boolean;
  //setIsDirty: (dirty: boolean) => void;
}

const UnsavedChangesHandler: React.FC<UnsavedChangesHandlerProps> = ({
  isDirty,
  //setIsDirty,
}) => {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [nextRoute, setNextRoute] = useState<string | null>(null);
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    const handleWindowClose = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };

    const handleBrowseAway = (url: string) => {
      if (!isDirtyRef.current) return;
      setNextRoute(url);
      setShowDialog(true);
      router.events.emit('routeChangeError');
      throw 'Route change aborted by user';
    };

    const handleRouteChangeError = (err: any, url: string) => {
      if (err !== 'Route change aborted by user') {
        console.error(err);
      }
    };

    window.addEventListener('beforeunload', handleWindowClose);
    router.events.on('routeChangeStart', handleBrowseAway);
    router.events.on('routeChangeError', handleRouteChangeError);

    return () => {
      window.removeEventListener('beforeunload', handleWindowClose);
      router.events.off('routeChangeStart', handleBrowseAway);
      router.events.off('routeChangeError', handleRouteChangeError);
    };
  }, []);

  const confirmNavigation = () => {
    setShowDialog(false);
    //setIsDirty(false);
    isDirtyRef.current = false; // Ensure the ref is updated immediately
    if (nextRoute) {
      void router.push(nextRoute);
    }
  };

  const cancelNavigation = () => {
    setShowDialog(false);
    setNextRoute(null);
  };

  return <Dialog open={showDialog}>
    <DialogTitle>Unsaved Changes</DialogTitle>
    <DialogContent>
      You have unsaved changes. Are you sure you want to leave?
    </DialogContent>
    <DialogActions>
      <Button onClick={cancelNavigation}>Stay</Button>
      <Button onClick={confirmNavigation} color="primary">
        Leave
      </Button>
    </DialogActions>
  </Dialog>;
};

export default UnsavedChangesHandler;