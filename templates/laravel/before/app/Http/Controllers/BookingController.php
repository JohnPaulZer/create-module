<?php

namespace App\Http\Controllers;

use App\Http\Resources\BookingResource;
use App\Services\BookingService;

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
