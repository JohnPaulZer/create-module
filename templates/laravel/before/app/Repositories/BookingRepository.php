<?php

namespace App\Repositories;

use App\Models\Booking;

class BookingRepository
{
    public function all(): array
    {
        return [Booking::class];
    }
}
