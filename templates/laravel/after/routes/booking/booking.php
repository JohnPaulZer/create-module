<?php

use App\Http\Controllers\Booking\BookingController;
use Illuminate\Support\Facades\Route;

Route::get('/bookings', [BookingController::class, 'index']);
