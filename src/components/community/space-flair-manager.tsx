import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface Flair {
  id: string;
  label: string;
  color: string;
}

export function SpaceFlairManager({ initialFlairs = [] }: { spaceId?: string, initialFlairs?: Flair[] }) {
  const [flairs, setFlairs] = useState<Flair[]>(initialFlairs);
  const [newLabel, setNewLabel] = useState('');

  const addFlair = () => {
    if (!newLabel.trim()) return;
    const newFlair: Flair = {
      id: Math.random().toString(36).substring(2, 9),
      label: newLabel,
      color: 'bg-indigo-500',
    };
    setFlairs([...flairs, newFlair]);
    setNewLabel('');
    toast.success(`Flair "${newLabel}" created`);
  };

  return (
    <div className="space-y-4 p-4 border border-border rounded-xl bg-card">
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-primary" />
        <h4 className="font-semibold text-sm">Space Member Flair Roles</h4>
      </div>
      <div className="flex flex-wrap gap-2">
        {flairs.map((f) => (
          <Badge key={f.id} className={`${f.color} text-white`}>
            {f.label}
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input 
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New role flair..."
          className="h-8 text-xs"
        />
        <Button size="sm" className="h-8 gap-1" onClick={addFlair}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
    </div>
  );
}
