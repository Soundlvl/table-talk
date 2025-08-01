// client/src/TableAdmin.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { Table, ImportedGameState, } from '../../shared/types';
import './styles.css';

interface TableAdminProps {
  socket: Socket | null;
  isConnected: boolean;
  onBack: () => void;
}

function TableAdmin({ socket, isConnected, onBack }: TableAdminProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  

  const fetchTables = useCallback(() => {
    // No need to check isAuthenticated here, this is only called when authenticated.
    if (socket && isConnected) {
      setIsLoading(true);
      socket.emit('admin:getTables');
    }
  }, [socket, isConnected]);

  // Fetch tables when component loads
  useEffect(() => {
    fetchTables();
  }, [fetchTables]);


  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    const handleTableList = (tableList: Table[]) => {
      // The server will only send this if we are authenticated.
      // The previous `if (isAuthenticated)` check caused a race condition and is removed.
      setTables(tableList);
      setIsLoading(false);
    };

    const handleTablesUpdated = () => {
      // Server broadcasts this, we should always refetch if we get it.
      fetchTables();
    };
    
    const handleTableExport = (gameState: ImportedGameState) => {
      if (!gameState) {
        alert('Error: No game state received for export.');
        return;
      }
      try {
        const jsonString = JSON.stringify(gameState, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        const safeTableName = (gameState.name || `table-${gameState.tableId}`).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `table-talk-session-${safeTableName}-${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
      } catch (error) {
        console.error('Error exporting game state:', error);
        alert('Error exporting game state.');
      }
    };

    socket.on('admin:tableList', handleTableList);
    socket.on('admin:tablesUpdated', handleTablesUpdated);
    socket.on('admin:tableExported', handleTableExport);

    // Auto-authenticate immediately - no password required
    socket.emit('admin:authenticate');

    return () => {
      socket.off('admin:tableList', handleTableList);
      socket.off('admin:tablesUpdated', handleTablesUpdated);
      socket.off('admin:tableExported', handleTableExport);
    };
  }, [socket, isConnected, fetchTables]);

  const handleDeleteTable = (tableId: string, tableName: string) => {
    if (socket && isConnected) {
      const isConfirmed = window.confirm(
        `Are you sure you want to permanently delete the table "${tableName}"?\nThis action cannot be undone.`
      );
      if (isConfirmed) {
        socket.emit('admin:deleteTable', { tableId });
      }
    }
  };

  const handleExportTable = (tableId: string) => {
    if (socket && isConnected) {
      socket.emit('admin:exportTable', { tableId });
    }
  };
  
  const handleTriggerImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!socket || !isConnected || !event.target.files) return;
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/json') {
      alert('Invalid file type. Please select a JSON file (.json) exported from the app.');
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = e.target?.result;
        if (typeof fileContent === 'string') {
          const importedState = JSON.parse(fileContent);
          if (importedState && importedState.saveVersion && importedState.charactersData) {
             socket.emit('admin:importTable', { fileContent });
             alert(`Importing table "${importedState.name || 'Unnamed Table'}". The table list will refresh shortly.`);
          } else {
            alert('Invalid game state file format.');
          }
        } else {
          alert('Could not read file content as text.');
        }
      } catch (parseError) {
        console.error('Error parsing imported JSON file:', parseError);
        alert('Could not parse the selected file. Please ensure it is a valid game state JSON file.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      console.error('Error reading imported file.');
      alert('There was an error reading the selected file.');
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  }, [socket, isConnected]);



  return (
    <div className="admin-panel-container">
       <input type="file" ref={fileInputRef} onChange={handleFileImport} style={{ display: 'none' }} accept=".json"/>
      <header className="app-header">
        <h1>Admin Panel</h1>
        <div className="header-right-content">
          <p className="connection-status">Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
        </div>
      </header>
      
      <div className="admin-panel-content">
        <div className="admin-actions-bar">
          <div>
            <button onClick={onBack} className="button-secondary">Back to Lobby</button>
          </div>
          <button onClick={handleTriggerImport} className="button-primary" disabled={!isConnected}>Import Table from File</button>
        </div>

        <div className="table-list-container">
          <h2>Manage All Tables</h2>
          {isLoading ? (
            <p>Loading tables...</p>
          ) : tables.length > 0 ? (
            <ul className="table-list admin-table-list">
              {tables.map(table => (
                <li key={table.id} className="table-list-item">
                  <div className="table-info">
                    <span className="table-name">{table.name}</span>
                    <span className="table-details">
                      ID: {table.id} | {table.playerCount} player(s) | Last active: {new Date(table.lastActivity).toLocaleString()}
                    </span>
                  </div>
                  <div className="table-actions">
                     <button
                        onClick={() => handleExportTable(table.id)}
                        className="export-table-button"
                        disabled={!isConnected}
                        title={`Export table "${table.name}"`}
                      >
                        Export
                      </button>
                    <button 
                      onClick={() => handleDeleteTable(table.id, table.name)}
                      className="delete-table-button"
                      disabled={!isConnected}
                      title={`Delete table "${table.name}"`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ textAlign: 'center', fontStyle: 'italic' }}>
              No tables found on the server.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default TableAdmin;