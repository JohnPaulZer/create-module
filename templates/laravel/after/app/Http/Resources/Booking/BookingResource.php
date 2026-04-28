<?php

namespace App\Http\Resources\Booking;

use Illuminate\Http\Resources\Json\JsonResource;

class BookingResource extends JsonResource
{
    public function toArray($request): array
    {
        return parent::toArray($request);
    }
}
