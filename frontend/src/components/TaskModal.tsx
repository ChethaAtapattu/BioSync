import React, { useState } from "react";
import { X } from "lucide-react";

interface TaskModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({ onClose, onSaved }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<number>(3);
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(30);

  // Default deadline 3 hours from now
  const defaultDeadline = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 16);
  const [deadline, setDeadline] = useState(defaultDeadline);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          difficulty,
          estimatedMinutes,
          deadline: new Date(deadline).toISOString(),
        }),
      });

      if (res.ok) {
        onSaved();
        onClose();
      }
    } catch (err) {
      console.error("Failed to save task:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white">Create Study Task</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">Task Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Implement MPU6050 gravity filter"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key objectives or details..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Difficulty Rating: <span className="text-blue-400 font-bold">{difficulty}/5</span> (
              {difficulty <= 2 ? "Easy" : difficulty === 3 ? "Medium" : "Hard"})
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>1 (Easy)</span>
              <span>3 (Medium)</span>
              <span>5 (Hard)</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Est. Duration (Mins)</label>
              <input
                type="number"
                min={5}
                max={480}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Deadline</label>
              <input
                type="datetime-local"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 border-t border-slate-800 pt-4 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 font-semibold"
            >
              Save Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
