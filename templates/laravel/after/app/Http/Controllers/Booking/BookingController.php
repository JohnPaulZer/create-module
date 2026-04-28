<?php

namespace App\Http\Controllers\Booking;

use App\Http\Controllers\Controller;
use App\Http\Resources\Booking\BookingResource;
use App\Services\Booking\BookingService;

class BookingController extends Controller
{
    public function index(): array
    {
        return [
            'items' => (new BookingService())->all(),
            'resource' => BookingResource::class,
        ];
    }
}
