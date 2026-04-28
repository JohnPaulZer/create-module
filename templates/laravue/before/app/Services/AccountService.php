<?php

namespace App\Services;

use App\Models\Account;

class AccountService
{
    public function all(): array
    {
        return [Account::class];
    }
}
