import { motion } from "framer-motion";
import { Calendar, MapPin, ExternalLink } from "lucide-react";

interface EventCardProps {
  event: {
    id: string;
    name: string;
    description: string;
    image_url: string;
    datetime_start: string;
    datetime_end: string;
    location_summary: string;
    is_free: boolean;
    url: string;
  };
}

export default function EventCard({ event }: EventCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className="flex flex-col w-72 shrink-0 rounded-2xl glass-panel overflow-hidden border border-white/60 relative shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="h-40 w-full relative bg-zinc-200 overflow-hidden">
        {event.image_url ? (
          <img 
            src={event.image_url} 
            alt={event.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-200 to-cyan-200 flex items-center justify-center text-blue-800/50 font-medium text-sm">
            Event Image
          </div>
        )}
        {event.is_free && (
          <div className="absolute top-3 left-3 bg-dopamine-mint text-zinc-900 text-xs font-bold px-2 py-1 rounded-md shadow-sm">
            FREE
          </div>
        )}
      </div>
      
      <div className="p-4 flex flex-col flex-1 gap-2 bg-white/40">
        <h4 className="font-bold text-zinc-800 line-clamp-2 text-sm leading-snug">
          {event.name}
        </h4>
        
        <div className="flex flex-col gap-1 text-xs text-zinc-600 mt-1">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">
              {new Date(event.datetime_start).toLocaleString('en-NZ', { 
                weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true 
              })}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate">{event.location_summary || 'Auckland'}</span>
          </div>
        </div>
        
        <p className="text-xs text-zinc-500 line-clamp-2 mt-1 flex-1">
          {event.description}
        </p>
        
        <a 
          href={event.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="mt-2 text-xs font-semibold text-blue-600 flex items-center gap-1 hover:text-blue-800 transition-colors"
        >
          View on Eventfinda <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </motion.div>
  );
}
