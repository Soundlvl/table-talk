// client/src/TableSelection.tsx
import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Table } from '../../shared/types';
import './styles.css';

interface TableSelectionProps {
  socket: Socket | null;
  isConnected: boolean;
  onTableSelected: (tableId: string) => void;
}

function TableSelection({ socket, isConnected, onTableSelected }: TableSelectionProps) {
  const [tables, setTables] = useState<Table[]>([]);
  const [newTableName, setNewTableName] = useState('');
  

  useEffect(() => {
    if (socket && isConnected) {
      socket.emit('requestTableList');

      const handleTableList = (tableList: Table[]) => setTables(tableList);
      const handleTableCreated = (newTable: Table) => onTableSelected(newTable.id);
      const handleTableNameInvalid = ({ message }: { message: string }) => alert(`Error creating table: ${message}`);
      const handleTableNameTaken = ({ name }: { name: string }) => alert(`The table name "${name}" is already in use. Please choose another.`);
      
      socket.on('tableList', handleTableList);
      socket.on('tableCreated', handleTableCreated);
      socket.on('tableNameInvalid', handleTableNameInvalid);
      socket.on('tableNameTaken', handleTableNameTaken);
      
      return () => {
        socket.off('tableList', handleTableList);
        socket.off('tableCreated', handleTableCreated);
        socket.off('tableNameInvalid', handleTableNameInvalid);
        socket.off('tableNameTaken', handleTableNameTaken);
      };
    }
  }, [socket, isConnected, onTableSelected]);

  const handleCreateTable = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = newTableName.trim();
    if (socket && isConnected && trimmedName) {
      socket.emit('createTable', { name: trimmedName });
    }
  };

  const handleJoinTable = (tableId: string) => {
    if (socket && isConnected) {
      // The `joinTable` event is now handled by the socket manager upon session change
      onTableSelected(tableId);
    }
  };

  return (
    <div className="table-selection-container">
      <header className="app-header">
        <h1 className="app-title">Welcome to Table Talk</h1>
        <div className="header-right-content">
            <p className="connection-status">Status: {isConnected ? 'Connected' : 'Disconnected'}</p>
        </div>
      </header>
      
      <div className="table-selection-content">
        <div className="table-selection-form">
          <form onSubmit={handleCreateTable}>
            <div>
              <label htmlFor="newTableName">Create a New Table</label>
              <input
                type="text"
                id="newTableName"
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Enter a name for your new table"
                disabled={!isConnected}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={!isConnected || !newTableName.trim()}
              style={{ marginTop: 'var(--space-md)' }}
            >
              Create & Join Table
            </button>
          </form>
        </div>

        <div className="table-list-container">
            <h2>Or Join an Existing Table</h2>
            {tables.length > 0 ? (
                <ul className="table-list">
                    {tables.map(table => (
                        <li key={table.id} className="table-list-item">
                            <div className="table-info">
                                <span className="table-name">{table.name}</span>
                                <span className="table-details">{table.playerCount} player(s) - Last active: {new Date(table.lastActivity).toLocaleString()}</span>
                            </div>
                            <button 
                                onClick={() => handleJoinTable(table.id)}
                                className="join-table-button"
                                disabled={!isConnected}
                            >
                                Join
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p style={{ textAlign: 'center', fontStyle: 'italic', padding: 'var(--space-md)' }}>
                    {isConnected ? 'No active tables found. Why not create one?' : 'Connecting...'}
                </p>
            )}
        </div>
      </div>
      
    </div>
  );
}

export default TableSelection;