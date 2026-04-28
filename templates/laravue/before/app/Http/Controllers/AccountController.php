<?php

namespace App\Http\Controllers;

use App\Services\AccountService;

class AccountController extends Controller
{
    public function index(): array
    {
        return (new AccountService())->all();
    }
}
