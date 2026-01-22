"use client";

import { useState, useTransition } from "react";
import { Calendar, Views, type View } from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import {
  Loader2,
  Save,
  Undo2,
  Clock,
  User,
  Mail,
  Video,
  ExternalLink,
} from "lucide-react";
import { format, differenceInMinutes, isBefore, startOfDay } from "date-fns";

import { localizer } from "../lib/localizer";
import {
  CALENDAR_CONFIG,
  MAX_TIME,
  MIN_TIME,
  AVAILABILITY_COLORS,
  BUSY_BLOCK_COLORS,
  BOOKING_STATUS_COLORS,
} from "../lib/constants";
import {
  calendarFormats,
  calendarMessages,
  formatTimeRange,
} from "../lib/formats";
import { useCalendarEvents } from "../hooks/use-calendar-events";
import { CalendarToolbar } from "./calendar-toolbar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { saveAvailability } from "@/lib/actions/availability";
import type {
  TimeBlock,
  BusyBlock,
  BookedBlock,
  CalendarEvent,
  TimeBlockInteraction,
  SlotInfo,
} from "../types";
import { isBusyBlock, isBookedBlock } from "../types";

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

interface AvailabilityCalendarProps {
  initialBlocks?: TimeBlock[];
  busyBlocks?: BusyBlock[];
  bookedBlocks?: BookedBlock[];
}

export function AvailabilityCalendar({
  initialBlocks = [],
  busyBlocks = [],
  bookedBlocks = [],
}: AvailabilityCalendarProps) {
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<BookedBlock | null>(
    null,
  );
  const [isSaving, startSaveTransition] = useTransition();

  const {
    events,
    hasChanges,
    handleSelectSlot,
    handleEventDrop,
    handleEventResize,
    removeBlock,
    copyDayToWeek,
    clearWeek,
    discardChanges,
    markAsSaved,
    getEventsForSave,
  } = useCalendarEvents(initialBlocks);

  const formatDuration = (start: Date, end: Date) => {
    const mins = differenceInMinutes(end, start);
    if (mins < 60) return `${mins}min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  };

  const handleSave = () => {
    startSaveTransition(async () => {
      try {
        const blocksToSave = getEventsForSave();
        const savedBlocks = await saveAvailability(blocksToSave);
        const newBlocks: TimeBlock[] = savedBlocks.map((b) => ({
          id: b.id,
          start: new Date(b.start),
          end: new Date(b.end),
        }));
        markAsSaved(newBlocks);
      } catch (error) {
        console.error("Failed to save:", error);
      }
    });
  };

  const allEvents: CalendarEvent[] = [
    ...events,
    ...busyBlocks,
    ...bookedBlocks,
  ];

  const isMonthView = view === Views.MONTH;
  const now = new Date();
  const todayStart = startOfDay(now);

  const slotPropGetter = (date: Date) => {
    if (isBefore(date, now)) {
      return {
        style: {
          backgroundColor: AVAILABILITY_COLORS.background,
          cursor: "not-allowed",
        },
      };
    }
    return {};
  };

  const dayPropGetter = (date: Date) => {
    if (isBefore(date, todayStart)) {
      return {
        style: {
          backgroundColor: AVAILABILITY_COLORS.backgroundHover,
        },
      };
    }
    return {};
  };

  const drillDown = (targetDate: Date) => {
    setDate(targetDate);
    setView(Views.WEEK);
  };

  const adaptEventArgs = (
    args: EventInteractionArgs<CalendarEvent>,
  ): TimeBlockInteraction => ({
    event: args.event as TimeBlock,
    start: args.start as Date,
    end: args.end as Date,
  });

  const onSlotSelect = (slotInfo: SlotInfo) => {
    if (isBefore(slotInfo.end, now)) return;
    isMonthView ? drillDown(slotInfo.start) : handleSelectSlot(slotInfo);
  };

  const onBlockSelect = (block: CalendarEvent) => {
    if (isBookedBlock(block)) {
      setSelectedBooking(block);
      return;
    }
    if (isBusyBlock(block)) return;
    isMonthView ? drillDown(block.start) : removeBlock(block.id);
  };

  const getStatusIndicator = (block: BookedBlock) => {
    switch (block.attendeeStatus) {
      case "accepted":
        return "✓";
      case "declined":
        return "✗";
      case "tentative":
        return "?";
      default:
        return "";
    }
  };

  const getBlockTitle = (block: CalendarEvent) => {
    if (isBusyBlock(block)) return isMonthView ? "Busy" : block.title;
    if (isBookedBlock(block)) {
      const indicator = getStatusIndicator(block);
      return indicator ? `${indicator} ${block.guestName}` : block.guestName;
    }
    return isMonthView ? formatTimeRange(block.start, block.end) : "Available";
  };

  const eventStyleGetter = (event: CalendarEvent) => {
    if (isBusyBlock(event)) {
      return {
        style: {
          backgroundColor: BUSY_BLOCK_COLORS.background,
          borderColor: BUSY_BLOCK_COLORS.border,
          color: BUSY_BLOCK_COLORS.text,
          opacity: 0.8,
        },
      };
    }
    if (isBookedBlock(event)) {
      const statusColors =
        event.attendeeStatus && event.attendeeStatus in BOOKING_STATUS_COLORS
          ? BOOKING_STATUS_COLORS[
              event.attendeeStatus as keyof typeof BOOKING_STATUS_COLORS
            ]
          : BOOKING_STATUS_COLORS.default;
      return {
        style: {
          backgroundColor: statusColors.background,
          borderColor: statusColors.border,
          color: statusColors.text,
          fontWeight: 600,
        },
      };
    }
    return {};
  };

  const ToolbarWithActions = (
    props: React.ComponentProps<typeof CalendarToolbar>,
  ) => (
    <CalendarToolbar
      {...props}
      showCopyButton={!isMonthView}
      onCopyDayToWeek={(dayIndex, includeWeekends) =>
        copyDayToWeek(dayIndex, date, includeWeekends)
      }
      onClearWeek={() => clearWeek(date)}
    />
  );

  return (
    <div className="relative overflow-visible h-[calc(100vh-180px)] min-h-[400px] sm:min-h-[600px]">
      {/* Calendar */}
      <DnDCalendar
        localizer={localizer}
        style={{ height: "100%" }}
        formats={calendarFormats}
        messages={calendarMessages}
        events={allEvents}
        view={view}
        date={date}
        views={[Views.MONTH, Views.WEEK, Views.DAY]}
        onView={setView}
        onNavigate={setDate}
        onDrillDown={drillDown}
        startAccessor="start"
        endAccessor="end"
        titleAccessor={getBlockTitle}
        eventPropGetter={eventStyleGetter}
        selectable
        resizable={!isMonthView}
        draggableAccessor={(event) =>
          !isMonthView && !isBusyBlock(event) && !isBookedBlock(event)
        }
        popup
        onSelectSlot={onSlotSelect}
        onSelectEvent={onBlockSelect}
        onEventDrop={(args) => {
          if (
            !isMonthView &&
            !isBusyBlock(args.event) &&
            !isBookedBlock(args.event)
          ) {
            handleEventDrop(adaptEventArgs(args));
          }
        }}
        onEventResize={(args) => {
          if (
            !isMonthView &&
            !isBusyBlock(args.event) &&
            !isBookedBlock(args.event)
          ) {
            handleEventResize(adaptEventArgs(args));
          }
        }}
        min={MIN_TIME}
        max={MAX_TIME}
        step={CALENDAR_CONFIG.step}
        timeslots={CALENDAR_CONFIG.timeslots}
        slotPropGetter={slotPropGetter}
        dayPropGetter={dayPropGetter}
        components={{ toolbar: ToolbarWithActions }}
      />
    </div>
  );
}
