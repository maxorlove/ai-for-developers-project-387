import "@typespec/http";

using TypeSpec.Http;

@service(#{ title: "Календарь звонков" })
@server("/", "Текущий сайт")
namespace Calendar;

@pattern("^[a-z0-9]+(-[a-z0-9]+)*$")
scalar EventTypeId extends string;

model EventType {
  id: EventTypeId;

  @pattern("\\S")
  title: string;

  @pattern("\\S")
  description: string;

  @minValue(1)
  @maxValue(540)
  durationMinutes: int32;
}

model CreatedEventTypeResponse extends CreatedResponse {
  @body body: EventType;
}

model ValidationError {
  code: "validation_error";
  message: string;
}

@error
model ValidationErrorResponse extends BadRequestResponse {
  @body body: ValidationError;
}

model EventTypeExistsError {
  code: "event_type_exists";
  message: string;
}

@error
model EventTypeExistsResponse extends ConflictResponse {
  @body body: EventTypeExistsError;
}

@post
@route("/api/event-types")
op createEventType(@body eventType: EventType): CreatedEventTypeResponse | ValidationErrorResponse | EventTypeExistsResponse;

@get
@route("/api/event-types")
op getEventTypes(): EventType[];

model Slot {
  startsAt: utcDateTime;
  endsAt: utcDateTime;
}

model AvailabilityDay {
  date: plainDate;
  slots: Slot[];
}

model Availability {
  timeZone: "Europe/Moscow";

  @minItems(14)
  @maxItems(14)
  days: AvailabilityDay[];
}

@error
model EventTypeNotFound {
  code: "event_type_not_found";
  message: string;
}

model EventTypeNotFoundResponse {
  @statusCode statusCode: 404;
  @body body: EventTypeNotFound;
}

@get
@route("/api/event-types/{id}/slots")
op getEventTypeSlots(@path id: string): Availability | EventTypeNotFoundResponse;

@maxLength(200)
scalar BookingTopic extends string;

model Booking extends Slot {
  id: string;
  eventTypeId: EventTypeId;
  eventTypeTitle: string;
  topic?: BookingTopic;
}

model BookingRequest {
  eventTypeId: EventTypeId;
  startsAt: offsetDateTime;
  topic?: BookingTopic;
}

model BookingCreatedResponse extends CreatedResponse {
  @body body: Booking;
}

model SlotTakenError {
  code: "slot_taken";
  message: string;
}

@error
model SlotTakenResponse extends ConflictResponse {
  @body body: SlotTakenError;
}

@post
@route("/api/bookings")
op createBooking(@body body: BookingRequest): BookingCreatedResponse | ValidationErrorResponse | EventTypeNotFoundResponse | SlotTakenResponse;

@get
@route("/api/bookings")
op getBookings(): Booking[];
