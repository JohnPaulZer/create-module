<?php

namespace App\Repositories\Booking;

use App\Models\Booking\Booking;

class BookingRepository
{
    public function all(): array
    {
        return [Booking::class];
    }
}
