<?php

namespace App\Services\Booking;

use App\Repositories\Booking\BookingRepository;

class BookingService
{
    public function all(): array
    {
        return (new BookingRepository())->all();
    }
}
