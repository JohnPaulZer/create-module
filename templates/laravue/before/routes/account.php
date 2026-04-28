<?php

use App\Http\Controllers\AccountController;
use Illuminate\Support\Facades\Route;

Route::get('/accounts', [AccountController::class, 'index']);
