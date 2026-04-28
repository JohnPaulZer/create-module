<?php

namespace App\Services;

use App\Repositories\BookingRepository;

class BookingService
{
    public function all(): array
    {
        return (new BookingRepository())->all();
    }
}
